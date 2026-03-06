const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../../src');
const granularPath = path.join(srcDir, 'granular-data.json');
const sloanPath = path.join(srcDir, 'sloan-data.json');
const seriesPath = path.join(srcDir, 'variation-series.json');

const sloan = JSON.parse(fs.readFileSync(sloanPath, 'utf8'));

const rawFilePath = '/Users/andrewdahl/Terapeak/output/Ryan Sloan CPA Sales Last 1095 Days.txt';
const rawContent = fs.readFileSync(rawFilePath, 'utf8');
const chunks = rawContent.split('\n{').map((c, i) => i === 0 ? c : '{' + c);

// 1. Institutional Asset Classification Map (Draft + Sapphire)
// Processing Priority: Precise Matches (Top) -> General Catch-all (Bottom)
const VARIATION_CONFIG = [
    { name: "Printing Plates 1/1", patterns: [/plate/i], limit: 1 },
    { name: "Padparadscha Sapphire 1/1", patterns: [/padparadscha/i], limit: 1 },
    { name: "Superfractor 1/1", patterns: [/super/i], limit: 1 },
    { name: "Red X-Fractor /5", patterns: [/red/i, /x-fractor/i], limit: 5 },
    { name: "Red Lava /5", patterns: [/red/i, /lava/i], limit: 5 },
    { name: "Red Sapphire /5", patterns: [/red/i, /sapphire/i, /\/5\b/i], limit: 5 },
    { name: "Red /5", patterns: [/\bred\b/i, /\/5\b/i], limit: 5 },
    { name: "Black X-Fractor /10", patterns: [/black/i, /x-fractor/i], limit: 10 },
    { name: "Black /10", patterns: [/\bblack\b/i, /\/10\b/i], limit: 10 },
    { name: "Orange Wave /25", patterns: [/orange/i, /wave/i], limit: 25 },
    { name: "Orange Sapphire /25", patterns: [/orange/i, /sapphire/i, /\/25\b/i], limit: 25 },
    { name: "Orange /25", patterns: [/\borange\b/i, /\/25\b/i], limit: 25 },
    { name: "Gold Shimmer /50", patterns: [/gold/i, /shimmer/i], limit: 50 },
    { name: "Gold Wave /50", patterns: [/gold/i, /wave/i], limit: 50 },
    { name: "Gold Sapphire /50", patterns: [/gold/i, /sapphire/i, /\/50\b/i], limit: 50 },
    { name: "Gold /50", patterns: [/\bgold\b/i, /\/50\b/i], limit: 50 },
    { name: "Sparkle /71", patterns: [/\bsparkle\b/i, /\bsparkles\b/i], limit: 71 },
    { name: "Yellow /75", patterns: [/\byellow\b/i, /\/75\b/i], limit: 75 },
    { name: "Green Lava /99", patterns: [/green/i, /lava/i], limit: 99 },
    { name: "Green Sapphire /99", patterns: [/green/i, /sapphire/i, /\/99\b/i], limit: 99 },
    { name: "Green /99", patterns: [/\bgreen\b/i, /\/99\b/i], limit: 99 },
    { name: "Blue Wave /150", patterns: [/blue/i, /wave/i], limit: 150 },
    { name: "HTA Choice /150", patterns: [/\bhta\b/i, /\bchoice\b/i], limit: 150 },
    { name: "Blue /150", patterns: [/\bblue\b/i, /\/150\b/i], limit: 150 },
    { name: "Aqua Lava /199", patterns: [/\baqua\b/i, /\blava\b/i], limit: 199 },
    { name: "Sapphire /199", patterns: [/\bsapphire\b/i, /\/199\b/i], limit: 199 },
    { name: "Purple /250", patterns: [/purple/i, /\/250\b/i], limit: 250 },
    { name: "Refractor /499", patterns: [/refractor/i, /\/499\b/i], limit: 499 }
];

const LOT_PATTERNS = [/ & /i, / \+ /i, /\band\b/i, /\bx[2-9]\b/i, / lot /i, / bundle /i, /\[[2-9]\]/i, /\([2-9]\)/i, /TIMES /i, /Plus\b/i, /With\b/i, /Bonus\b/i, /QTY/i, /Set of/i, /Wholesale/i, /\b[2-9]x\b/i];
const IP_PATTERNS = [/\bIP\b/i, /In[ -]Person/i, /\bNon[ -]/i, /\bsigned\b/i, /\bhand[ -]signed\b/i];
const PRODUCT_EXCLUSIONS = [/all-america/i, /all american/i, /perfect game/i];

const GRADE_MAP = [
    { name: "PSA 10", patterns: [/\bPSA\s*10\b/i, /\bGEM\s*10\b/i] },
    { name: "BGS 10", patterns: [/\bBGS\s*10\b/i, /\bPRISTINE\s*10\b/i] },
    { name: "SGC 10", patterns: [/\bSGC\s*10\b/i, /\bSGC\s*100\b/i] },
    { name: "PSA 9", patterns: [/\bPSA\s*9\b/i, /\bMINT\s*9\b/i] },
    { name: "BGS 9.5", patterns: [/\bBGS\s*9.5\b/i] },
    { name: "SGC 9.5", patterns: [/\bSGC\s*9.5\b/i] },
    { name: "PSA 8", patterns: [/\bPSA\s*8\b/i, /\bNM-MT\s*8\b/i] },
    { name: "BGS 9", patterns: [/\bBGS\s*9\b/i] },
    { name: "SGC 9", patterns: [/\bSGC\s*9\b/i] }
];

// 1. Intellectual Card Code Exclusion
function classifyListing(title) {
    const low = title.toLowerCase().replace(/refractors/g, "refractor");

    // 0. IP / Aftermarket / Product Exclusion (STRICT)
    if (IP_PATTERNS.some(p => p.test(low)) || PRODUCT_EXCLUSIONS.some(p => p.test(low))) {
        return "EXCLUDE_INVALID_ASSET";
    }

    // 1. Intellectual Card Code Exclusion
    const codeMatch = low.match(/#([a-z-]+)\d*/i);
    if (codeMatch) {
        const fullCode = codeMatch[0].toUpperCase();
        // If it's a card number (not just a lot #) and doesn't have CPA, dump it.
        // But ignore pure serial numbers like #5/5
        if (!/^\d/.test(codeMatch[1]) && !fullCode.includes("CPA")) {
            return "EXCLUDE_WRONG_CODE";
        }
    }

    // 2. Primary Variation Classification
    for (const v of VARIATION_CONFIG) {
        if (v.patterns.every(p => p.test(low))) {
            return v.name;
        }
    }

    // 3. Serial Number Fallback & Strictness
    const serialMatch = low.match(/\/(\d+)\b/);
    if (serialMatch) {
        const serialCount = parseInt(serialMatch[1], 10);
        const match = VARIATION_CONFIG.find(v => v.limit === serialCount);
        if (match) return match.name;

        // If it has a serial number that doesn't match our variants (e.g. /125), EXCLUDE IT.
        return "EXCLUDE_AMBIGUOUS_SERIAL";
    }

    // 4. Strict Base Detection
    // If it has "Refractor", "Chrome", or any color indicator/serial indicator but we didn't catch it, 
    // it's too risky to call it "Base".
    const dangerKeywords = [/refractor/i, /#/i, /\bsilver\b/i, /\bprizm\b/i, /\boptic\b/i, /\bchrome\b/i];
    if (dangerKeywords.some(p => p.test(low)) && !low.includes("cpa")) {
        // Exception: "Bowman Chrome" is common for base, so only exclude if it's "Chrome" + "Refractor" or "Chrome" + "#"
        if (low.includes("refractor") || low.includes("#")) {
            return "EXCLUDE_AMBIGUOUS_BASE";
        }
    }

    // Auto Keyword Check (Broadened) - Run at end to ensure we don't catch non-autos
    const autoKeywords = [/\bauto/i, /autograph/i, /\bau\b/i];
    if (!autoKeywords.some(p => p.test(low))) {
        return "EXCLUDE_NON_AUTO";
    }

    return "Base";
}

// 4. TRANSFORM DATA
const rebuiltGranular = {};

chunks.forEach(chunk => {
    try {
        const obj = JSON.parse(chunk);
        if (obj._type !== "SearchResultsModule") return;

        (obj.results || []).forEach(res => {
            const title = res.listing.title.textSpans[0].text;
            if (LOT_PATTERNS.some(p => p.test(title))) return;

            const variation = classifyListing(title);
            if (variation.startsWith("EXCLUDE_")) return;

            let grade = "Raw";
            for (const g of GRADE_MAP) {
                if (g.patterns.some(p => p.test(title))) {
                    grade = g.name;
                    break;
                }
            }

            const priceText = res.totalsales?.textSpans[0]?.text || "$0";
            const salePrice = parseFloat(priceText.replace(/[^0-9.]/g, ""));

            const dateText = res.datelastsold?.textSpans[0]?.text || "Jan 1, 2025";
            const saleDateObj = new Date(dateText);
            const saleDate = saleDateObj.toISOString().split('T')[0];

            const sale = {
                listing_title: title,
                sale_price: salePrice,
                sale_date: saleDate,
                item_id: res.listing.itemId.value
            };

            if (!rebuiltGranular[variation]) rebuiltGranular[variation] = {};
            if (!rebuiltGranular[variation][grade]) rebuiltGranular[variation][grade] = [];
            rebuiltGranular[variation][grade].push(sale);
        });
    } catch (e) { }
});

// 2. TREND INDEX NORMALIZATION (7D TWMA)
function calculateIndex(sales, timeframeDays = 90) {
    const end = new Date("2026-03-05");
    const start = new Date(end);
    start.setDate(end.getDate() - timeframeDays);

    const dailyMap = {};
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dailyMap[d.toISOString().split('T')[0]] = { sum: 0, count: 0 };
    }

    sales.forEach(s => {
        if (dailyMap[s.sale_date]) {
            dailyMap[s.sale_date].sum += s.sale_price;
            dailyMap[s.sale_date].count += 1;
        }
    });

    const dates = Object.keys(dailyMap).sort();
    let rolling = [];
    return dates.map(date => {
        const day = dailyMap[date];
        const val = day.count > 0 ? day.sum / day.count : (rolling.length > 0 ? rolling[rolling.length - 1] : 50);
        rolling.push(val);
        if (rolling.length > 7) rolling.shift();
        const twma = rolling.reduce((a, b) => a + b, 0) / rolling.length;
        return { date, indexValue: parseFloat(twma.toFixed(2)), volume: day.count };
    });
}

// 3. BENCHMARKING (STRICT BASE ONLY)
const TODAY = new Date("2026-03-05");
const THIRTY_AGO = new Date(TODAY);
THIRTY_AGO.setDate(TODAY.getDate() - 30);

const baseRawSales = rebuiltGranular["Base"]?.["Raw"] || [];
const recentBase = baseRawSales.filter(s => new Date(s.sale_date) >= THIRTY_AGO);
const benchmarkPrice = recentBase.length > 0
    ? recentBase.reduce((a, b) => a + b.sale_price, 0) / recentBase.length
    : 55.24;

console.log(`Audited Base Benchmark (30D TWMA): $${benchmarkPrice.toFixed(2)} (n=${recentBase.length})`);

const newMultipliers = {};
const newGradeMultipliers = {};
const gradeDataForAvg = {};

// Sort By Limit Descending (Highest Print Run at Top), Base always first
// Within each limit group: "True Color" (e.g. "Red /5") goes first, then variations
const sortedRefs = [...VARIATION_CONFIG].sort((a, b) => {
    if (a.limit !== b.limit) return b.limit - a.limit;

    const aIsTrue = a.name.split(' ').length === 2 || (a.name.includes('/') && a.name.split(' ').length === 2);
    const bIsTrue = b.name.split(' ').length === 2 || (b.name.includes('/') && b.name.split(' ').length === 2);

    // Check if it's just "Color /Limit" or "Superfractor 1/1"
    const isPure = (n) => {
        const parts = n.split(' ');
        return parts.length === 2 || (parts.length === 3 && parts[1] === '/');
    };

    const aPure = isPure(a.name);
    const bPure = isPure(b.name);

    if (aPure && !bPure) return -1;
    if (!aPure && bPure) return 1;

    return 0;
});
const allSortedVariations = ["Base", ...sortedRefs.map(v => v.name)];

allSortedVariations.forEach(vName => {
    const conds = rebuiltGranular[vName] || {};
    const allSales = Object.values(conds).flat();
    if (allSales.length === 0) return;

    const sorted = allSales.sort((a, b) => new Date(b.sale_date) - new Date(a.date));
    const recent = allSales.filter(s => s.sale_date && new Date(s.sale_date) >= THIRTY_AGO);

    let price = vName === "Base" ? benchmarkPrice : (recent.length > 0
        ? recent.reduce((a, b) => a + b.sale_price, 0) / recent.length
        : sorted[0].sale_price);

    newMultipliers[vName] = {
        median: parseFloat(price.toFixed(2)),
        multiplier: vName === "Base" ? 1.0 : parseFloat((price / benchmarkPrice).toFixed(2)),
        count: allSales.length,
        limit: VARIATION_CONFIG.find(v => v.name === vName)?.limit || 1000000
    };

    const rawPrices = (conds["Raw"] || []).map(s => s.sale_price);
    const rAvg = rawPrices.length > 0 ? rawPrices.reduce((a, b) => a + b, 0) / rawPrices.length : price;
    for (const [grade, sales] of Object.entries(conds)) {
        if (grade === "Raw") continue;
        if (!gradeDataForAvg[grade]) gradeDataForAvg[grade] = [];
        sales.forEach(s => gradeDataForAvg[grade].push({ price: s.sale_price, ratio: s.sale_price / rAvg }));
    }
});

// Aggregate Condition-Specific Totals for KPI Calibration
const totalRawSales = Object.values(rebuiltGranular).reduce((acc, v) => acc + (v["Raw"]?.length || 0), 0);
const totalGradedSales = Object.values(rebuiltGranular).reduce((acc, v) => {
    return acc + Object.entries(v).filter(([grade]) => grade !== "Raw").reduce((sum, [_, s]) => sum + s.length, 0);
}, 0);

const recentRawVol = Object.values(rebuiltGranular).reduce((acc, v) => {
    return acc + (v["Raw"] || []).filter(s => new Date(s.sale_date) >= THIRTY_AGO).length;
}, 0);
const recentGradedVol = Object.values(rebuiltGranular).reduce((acc, v) => {
    return acc + Object.entries(v).filter(([grade]) => grade !== "Raw").reduce((sum, [_, s]) => {
        return sum + s.filter(x => new Date(x.sale_date) >= THIRTY_AGO).length;
    }, 0);
}, 0);

for (const [grade, data] of Object.entries(gradeDataForAvg)) {
    const avgPrice = data.reduce((a, b) => a + b.price, 0) / data.length;
    newGradeMultipliers[grade] = {
        currentTwma: parseFloat(avgPrice.toFixed(2)),
        multiplier: parseFloat((avgPrice / benchmarkPrice).toFixed(2)),
        count: data.length
    };
}

// 5. KPI & MOMENTUM SCORING
const rawIndex = calculateIndex(Object.values(rebuiltGranular).flatMap(v => v["Raw"] || []));
const gradedIndex = calculateIndex(Object.values(rebuiltGranular).flatMap(v => Object.entries(v).filter(([k]) => k !== "Raw").flatMap(([_, s]) => s)));

const momentumScore = (() => {
    const prices = rawIndex.map(d => d.indexValue);
    const recent = prices.slice(-10);
    const early = prices.slice(0, 10);
    const avgR = (recent.reduce((a, b) => a + b, 0) / (recent.length || 1)) || 0;
    const avgE = (early.reduce((a, b) => a + b, 0) / (early.length || 1)) || 0;
    const velocity = Math.min(((avgR - avgE) / (avgE || 1)) * 100, 60);
    const volMetric = Math.min((recentBase.length / 50) * 30, 25);
    const avgMult = (Object.values(newMultipliers).reduce((a, m) => a + m.multiplier, 0) / (Object.keys(newMultipliers).length || 1)) || 0;
    return Math.round(Math.min(velocity + volMetric + (avgMult * 1.5), 100));
})();

sloan.multipliers = newMultipliers;
sloan.gradeMultipliers = newGradeMultipliers;
sloan.rawKpi.currentBaseAvg = parseFloat(benchmarkPrice.toFixed(2));
sloan.rawKpi.totalSales = totalRawSales;
sloan.rawKpi.volume30d = recentRawVol;
sloan.gradedKpi.totalSales = totalGradedSales;
sloan.gradedKpi.volume30d = recentGradedVol;
sloan.rawIndexData = rawIndex;
sloan.gradedIndexData = gradedIndex;
sloan.momentumScore = momentumScore;

const finalGranular = {};
allSortedVariations.forEach(v => {
    if (rebuiltGranular[v]) finalGranular[v] = rebuiltGranular[v];
});
fs.writeFileSync(granularPath, JSON.stringify(finalGranular, null, 2));
fs.writeFileSync(sloanPath, JSON.stringify(sloan, null, 2));

const series = {};
for (const [vName, conds] of Object.entries(rebuiltGranular)) {
    series[vName] = Object.values(conds).flat()
        .map(s => ({ date: s.sale_date, price: s.sale_price }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
}
fs.writeFileSync(seriesPath, JSON.stringify(series, null, 2));

console.log(`Institutional Audit Verified:`);
console.log(`- Final Classified Total: ${sloan.rawKpi.totalSales}`);
console.log(`- Base (Non-Parallel) Unit Count: ${newMultipliers["Base"]?.count || 0}`);
