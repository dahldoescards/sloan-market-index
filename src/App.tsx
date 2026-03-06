import { useState, useMemo, memo } from "react";
import {
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  ComposedChart,
  Area,
  AreaChart,
  XAxis,
  YAxis
} from "recharts";
import {
  ChevronUp,
  ChevronDown,
  Layers,
  TrendingUp,
  LayoutGrid,
  ShieldCheck,
  TrendingDown
} from "lucide-react";

import sloanRaw from "./sloan-data.json";
import variationRaw from "./variation-series.json";
import granularDataRaw from "./granular-data.json";

/* ───────────────────────── TypeScript Interfaces ───────────────────────── */

interface IndexDataPoint {
  date: string;
  indexValue: number;
  volume: number;
}

interface KpiMetrics {
  currentBaseAvg?: number;
  currentAvg?: number;
  delta30d?: number;
  volume30d: number;
  totalSales: number;
  totalRevenue: number;
}

interface MultiplierEntry {
  median: number;
  multiplier: number;
  count: number;
}

interface GradeMultiplierEntry {
  currentTwma: number;
  multiplier: number;
  count: number;
}

interface SloanData {
  rawIndexData: IndexDataPoint[];
  gradedIndexData: IndexDataPoint[];
  rawKpi: KpiMetrics;
  gradedKpi: KpiMetrics;
  multipliers: Record<string, MultiplierEntry>;
  gradeMultipliers: Record<string, GradeMultiplierEntry>;
}

interface Sale {
  listing_title: string;
  sale_price: number;
  sale_date: string;
  item_id: string;
}

interface GranularData {
  [variation: string]: {
    [condition: string]: Sale[];
  };
}

/* ───────────────────────── Constants ───────────────────────── */

const baseData = sloanRaw as SloanData;
const variationSeries = variationRaw as Record<string, { date: string; price: number }[]>;
const granularData = granularDataRaw as GranularData;

const VARIATION_COLORS: Record<string, string> = {
  "Superfractor 1/1": "#facc15",
  "Padparadscha Sapphire 1/1": "#f472b6",
  "Red X-Fractor /5": "#ef4444",
  "Red Lava /5": "#ef4444",
  "Red Sapphire /5": "#dc2626",
  "Red /5": "#dc2626",
  "Printing Plates 1/1": "#737373",
  "Black X-Fractor /10": "#171717",
  "Black /10": "#262626",
  "Orange Sapphire /25": "#f97316",
  "Orange Wave /25": "#f97316",
  "Orange /25": "#ea580c",
  "Gold Sapphire /50": "#eab308",
  "Shimmer Gold /50": "#eab308",
  "Gold Wave /50": "#ca8a04",
  "Gold /50": "#a16207",
  "Sparkle /71": "#e879f9",
  "Yellow /75": "#facc15",
  "Green Sapphire /99": "#10b981",
  "Green Lava /99": "#22c55e",
  "Green /99": "#16a34a",
  "Sapphire /199": "#0ea5e9",
  "HTA Choice /150": "#06b6d4",
  "Blue Wave /150": "#3b82f6",
  "Blue /150": "#2563eb",
  "Aqua Lava /199": "#14b8a6",
  "Purple /250": "#a855f7",
  "Refractor /499": "#6366f1",
  "Base": "#94a3b8",
};

const VARIATION_TEXT_CLASSES: Record<string, string> = {
  "Superfractor 1/1": "text-yellow-400 font-black brightness-125",
  "Padparadscha Sapphire 1/1": "text-pink-400",
  "Red X-Fractor /5": "text-red-500",
  "Red Lava /5": "text-red-500",
  "Red Sapphire /5": "text-red-600",
  "Red /5": "text-red-600",
  "Printing Plates 1/1": "text-slate-400",
  "Black X-Fractor /10": "text-slate-300",
  "Black /10": "text-slate-400",
  "Orange Sapphire /25": "text-orange-500",
  "Orange Wave /25": "text-orange-500",
  "Orange /25": "text-orange-600",
  "Gold Sapphire /50": "text-yellow-400",
  "Shimmer Gold /50": "text-yellow-400",
  "Gold Wave /50": "text-yellow-500",
  "Gold /50": "text-yellow-600",
  "Sparkle /71": "text-fuchsia-400",
  "Yellow /75": "text-yellow-300",
  "Green Sapphire /99": "text-emerald-500",
  "Green Lava /99": "text-green-500",
  "Green /99": "text-green-600",
  "Sapphire /199": "text-sky-500",
  "HTA Choice /150": "text-cyan-500",
  "Blue Wave /150": "text-blue-500",
  "Blue /150": "text-blue-600",
  "Aqua Lava /199": "text-teal-500",
  "Purple /250": "text-purple-500",
  "Refractor /499": "text-indigo-400",
  "Base": "text-slate-400",
};

/* ───────────────────────── Formatters & Utility Cache ───────────────────────── */

const shortDateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
const longDateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });

const formatDateUTC = (dateString: string, useLongFormat: boolean = false) => {
  const dateObj = new Date(dateString.includes('T') ? dateString : dateString + "T12:00:00Z");
  return useLongFormat ? longDateFormatter.format(dateObj) : shortDateFormatter.format(dateObj);
};

// js-cache-property-access: Cache NumberFormat objects for reuse
const currencyFormatters = new Map<number, Intl.NumberFormat>();
const formatCurrency = (val: number, maxFraction: number = 2) => {
  if (!currencyFormatters.has(maxFraction)) {
    currencyFormatters.set(maxFraction, new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: maxFraction
    }));
  }
  return currencyFormatters.get(maxFraction)!.format(val);
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const idx = payload.find((p: any) => p.dataKey === "indexValue");
  const vol = payload.find((p: any) => p.dataKey === "volume");

  return (
    <div className="bg-slate-900 border border-slate-700/50 p-4 rounded-xl shadow-2xl antialiased">
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 tabular-nums">
        {formatDateUTC(label, true)}
      </div>
      {idx ? (
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          <div className="text-sm font-black text-white tabular-nums tracking-tight">Index: {formatCurrency(idx.value)}</div>
        </div>
      ) : null}
      {vol ? (
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
          <div className="text-sm font-bold text-cyan-400 tabular-nums tracking-tight">Volume: {vol.value} Sales</div>
        </div>
      ) : null}
    </div>
  );
}

const VariationChart = memo(function VariationChart({ name }: { name: string }) {
  const series = variationSeries[name];
  if (!series || series.length < 2) return null;

  const color = VARIATION_COLORS[name] || "#10b981";
  const prices = series.map((s) => s.price);
  const median = [...prices].sort((a, b) => a - b)[Math.floor(prices.length / 2)];

  const chartPoints = series.map((s) => ({
    ...s,
    dateLabel: s.date,
  }));

  return (
    <div className="flex flex-col p-6 bg-slate-900 rounded-xl border border-slate-800 gap-2 hover:border-slate-700 hover:shadow-lg transition-all duration-300 antialiased group">
      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-col gap-1 w-2/3 pr-2">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest tabular-nums">{series.length} Sales</div>
          <div className={`text-xs font-black truncate w-full tracking-tight ${VARIATION_TEXT_CLASSES[name] || 'text-slate-300'}`}>{name}</div>
        </div>
        <div className="text-right flex flex-col gap-1 w-1/3">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">MED</div>
          <div className="text-xs font-bold text-white tabular-nums tracking-tight">${median.toFixed(0)}</div>
        </div>
      </div>
      <div className="w-full min-h-[80px] opacity-80 group-hover:opacity-100 transition-opacity duration-300">
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={chartPoints}>
            <defs>
              <linearGradient id={`grad-${name.replace(/[^a-zA-Z]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="price"
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${name.replace(/[^a-zA-Z]/g, '')})`}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

/* ───────────────────────── Pre-Calculated Statics ───────────────────────── */
// rendering-hoist-jsx: move static derivations outside component body
const ACTIVE_VARIATIONS = Object.keys(baseData.multipliers).filter(v => variationSeries[v] && variationSeries[v].length >= 2);

/* ───────────────────────── Main Application ───────────────────────── */

export default function App() {
  const [viewMode, setViewMode] = useState<"Raw" | "Graded">("Raw");

  const chartData = useMemo(() => {
    const source = viewMode === "Raw" ? baseData.rawIndexData : baseData.gradedIndexData;
    return source.map(d => ({
      ...d,
      dateLabel: d.date
    }));
  }, [viewMode]);

  const currentKpi = viewMode === "Raw" ? baseData.rawKpi : baseData.gradedKpi;

  const breakoutScore = useMemo(() => {
    const prices = baseData.rawIndexData.map(d => d.indexValue);
    const recent = prices.slice(-10);
    const early = prices.slice(0, 10);
    const avgR = (recent.reduce((a, b) => a + b, 0) / (recent.length || 1)) || 0;
    const avgE = (early.reduce((a, b) => a + b, 0) / (early.length || 1)) || 0;
    const momentum = Math.min(((avgR - avgE) / (avgE || 1)) * 100, 60);
    const volScore = Math.min((baseData.rawKpi.volume30d / 100) * 30, 25);
    const mults = Object.values(baseData.multipliers);
    const avgM = (mults.reduce((a, m) => a + m.multiplier, 0) / (mults.length || 1)) || 0;
    return Math.round(Math.min(momentum + volScore + (avgM * 1.5), 100));
  }, []);

  const sortedMults = useMemo(() =>
    Object.entries(baseData.multipliers)
      .map(([name, e]) => ({ name, ...e }))
    , []);

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-200 selection:bg-emerald-500/30 antialiased">
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-10 md:px-8 md:py-12">

        {/* ── Dashboard Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center w-full gap-6 mb-10">
          <div className="flex flex-col gap-2 relative">
            <div className="flex items-center gap-3 text-emerald-400 font-bold uppercase tracking-widest text-[10px]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_12px_rgba(16,185,129,1)]" />
              Institutional Market Data
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white flex items-center gap-3">
              Ryan Sloan <span className="text-slate-600">Index</span>
            </h1>
            <p className="text-slate-400 text-sm font-medium max-w-2xl leading-relaxed mt-1">
              Real-time portfolio positioning metrics across <span className="text-slate-300 tabular-nums font-bold text-[13px]">{baseData.rawKpi.totalSales + baseData.gradedKpi.totalSales} records</span> and verified data points. First Bowman CPA.
            </p>
          </div>

          <div className="flex bg-slate-900/80 backdrop-blur-md p-1.5 rounded-[14px] border border-slate-800 shadow-xl shrink-0 overflow-x-auto max-w-full">
            <button
              onClick={() => setViewMode("Raw")}
              className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-[10px] text-sm font-bold whitespace-nowrap shrink-0 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:scale-95 ${viewMode === "Raw" ? "bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)]" : "text-slate-400 hover:text-slate-200"}`}
            >
              Raw Comps
            </button>
            <button
              onClick={() => setViewMode("Graded")}
              className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-[10px] text-sm font-bold whitespace-nowrap shrink-0 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:scale-95 ${viewMode === "Graded" ? "bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)]" : "text-slate-400 hover:text-slate-200"}`}
            >
              Graded Index
            </button>
          </div>
        </div>

        {/* ── Key Performance Indicators ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 relative">

          <div className="flex flex-col p-6 bg-slate-900 rounded-2xl border border-slate-800 gap-2 hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.05)] transition-all duration-300">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">Index Reference</div>
            <div className="text-4xl font-black text-white tabular-nums tracking-tight">
              {formatCurrency(currentKpi.currentBaseAvg || currentKpi.currentAvg || 0)}
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              {currentKpi.delta30d !== undefined ? (
                <span className={`text-xs font-black flex items-center gap-0.5 tabular-nums ${currentKpi.delta30d >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {currentKpi.delta30d >= 0 ? <ChevronUp size={14} /> : <TrendingDown size={14} />}
                  {Math.abs(currentKpi.delta30d)}%
                </span>
              ) : null}
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">30d Velocity</span>
            </div>
          </div>

          <div className="flex flex-col p-6 bg-slate-900 rounded-2xl border border-slate-800 gap-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">Market Liquidity</div>
            <div className="text-4xl font-black text-white tabular-nums tracking-tight">{currentKpi.volume30d}</div>
            <div className="text-xs font-bold text-slate-500 mt-2 truncate">
              Transactions finalized in last 30 days
            </div>
          </div>

          <div className="flex flex-col p-6 bg-slate-900 rounded-2xl border border-slate-800 gap-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">Total Volume</div>
            <div className="text-4xl font-black text-white tabular-nums tracking-tight">{currentKpi.totalSales.toLocaleString()}</div>
            <div className="text-xs font-bold text-slate-500 mt-2 truncate">
              Verified {viewMode} sales in database
            </div>
          </div>

          {/* Elevated Breakout Potential Indicator */}
          <div className={`flex flex-col p-6 rounded-2xl border gap-2 relative overflow-hidden group transition-all duration-300 ${breakoutScore >= 70 ? 'bg-gradient-to-br from-amber-500/[0.12] to-transparent border-amber-500/40 shadow-[0_0_40px_rgba(245,158,11,0.1)]' : 'bg-slate-900 border-slate-800'}`}>
            {breakoutScore >= 70 ? (
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/20 blur-[40px] rounded-full mix-blend-screen pointer-events-none" />
            ) : null}
            <div className="relative z-10 text-[10px] font-bold text-amber-500/90 uppercase tracking-widest truncate shadow-amber-900/50">Breakout Potential</div>
            <div className="relative z-10 text-4xl font-black text-white tabular-nums tracking-tight">
              {breakoutScore}
              <span className="text-lg text-slate-500/80 font-bold ml-1">/100</span>
            </div>
            <div className={`relative z-10 text-xs font-black tracking-tight mt-2 truncate ${breakoutScore >= 70 ? 'text-amber-400' : 'text-amber-600'}`}>
              {breakoutScore >= 70 ? 'High Conviction Indicator' : breakoutScore >= 40 ? 'Moderate Scaling' : 'Base Accumulation'}
            </div>
          </div>
        </div>

        {/* ── Sloan Index Main Chart ── */}
        <div className="flex flex-col p-6 md:p-8 bg-slate-900 rounded-2xl border border-slate-800 gap-6 mb-8 relative overflow-hidden">

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-black text-white uppercase">Sloan 90-Day Trend Index</h2>
              <p className="text-slate-400 text-sm font-medium">7-day time-weighted moving average overlayed with daily volume patterns.</p>
            </div>
            <div className="flex items-center gap-6 tabular-nums">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">TWMA Index</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400/60" />
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Daily Volume</span>
              </div>
            </div>
          </div>

          <div className="w-full min-h-[400px] relative z-10">
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient id="mainIdxGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  minTickGap={50}
                  tickMargin={12}
                  tickFormatter={(tick) => formatDateUTC(tick, false)}
                  tick={{ fill: "#64748b", fontSize: 11, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
                />
                <YAxis
                  yAxisId="price"
                  tick={{ fill: "#64748b", fontSize: 11, fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `$${v}`}
                  domain={['auto', 'auto']}
                />
                <YAxis
                  yAxisId="volume"
                  orientation="right"
                  tick={{ fill: "#334155", fontSize: 10, fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1, strokeDasharray: "4 4" }} />
                <Bar
                  yAxisId="volume"
                  dataKey="volume"
                  fill="#06b6d4"
                  opacity={0.3}
                  barSize={12}
                  radius={[4, 4, 0, 0]}
                />
                <Area
                  yAxisId="price"
                  type="monotone"
                  dataKey="indexValue"
                  stroke="#10b981"
                  strokeWidth={3}
                  fill="url(#mainIdxGrad)"
                  dot={false}
                  activeDot={{ r: 6, stroke: "#10b981", strokeWidth: 2, fill: "#030712", strokeDasharray: '' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Multiplier & Grade Matrices ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">

          <div className="flex flex-col p-6 md:p-8 bg-slate-900 rounded-2xl border border-slate-800 gap-4">
            <div className="flex items-center gap-3 text-emerald-400 mb-2 border-b border-slate-800/80 pb-5">
              <Layers size={22} />
              <div className="flex flex-col">
                <h2 className="text-xl font-black text-white uppercase">Variation Matrix</h2>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Multipliers vs Base 1.0x</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="pb-4 pt-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-2">Variation</th>
                    <th className="pb-4 pt-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right w-24 pr-4">Volume</th>
                    <th className="pb-4 pt-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right w-32 pr-4">Median Price</th>
                    <th className="pb-4 pt-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right w-32 pr-2">Multiplier</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMults.map(m => (
                    <tr key={m.name} className="hover:bg-slate-800/40 transition-colors duration-200">
                      <td className="py-4 border-b border-slate-800/50 px-2 group">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full shrink-0 group-hover:scale-125 transition-transform duration-300" style={{ background: VARIATION_COLORS[m.name] || '#64748b', boxShadow: `0 0 8px ${VARIATION_COLORS[m.name]}80` }} />
                          <span className={`text-sm font-bold uppercase tracking-wider ${VARIATION_TEXT_CLASSES[m.name] || 'text-slate-300'}`}>{m.name}</span>
                        </div>
                      </td>
                      <td className="py-4 border-b border-slate-800/50 text-right pr-4">
                        <div className="text-[13px] font-bold text-slate-400 tabular-nums">
                          {m.count}
                        </div>
                      </td>
                      <td className="py-4 border-b border-slate-800/50 text-right pr-4">
                        <div className="text-[13px] font-black text-slate-200 tabular-nums">
                          {formatCurrency(parseFloat(m.median.toString()))}
                        </div>
                      </td>
                      <td className="py-4 border-b border-slate-800/50 text-right pr-2">
                        <div className="text-[13px] font-black text-emerald-400 tabular-nums">{parseFloat(m.multiplier.toString()).toFixed(1)}x</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col p-6 md:p-8 bg-slate-900 rounded-2xl border border-slate-800 gap-4">
            <div className="flex items-center gap-3 text-blue-400 mb-2 border-b border-slate-800/80 pb-5">
              <ShieldCheck size={22} />
              <div className="flex flex-col">
                <h2 className="text-xl font-black text-white uppercase">Grade Matrix</h2>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Institutional Premium Stack</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="pb-4 pt-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-2">Grade</th>
                    <th className="pb-4 pt-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right w-24 pr-4">Sales</th>
                    <th className="pb-4 pt-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right w-32 pr-4">Avg Price</th>
                    <th className="pb-4 pt-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right w-32 pr-2">Multiplier</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(baseData.gradeMultipliers)
                    .sort((a, b) => b[1].multiplier - a[1].multiplier)
                    .map(([grade, entry]) => (
                      <tr key={grade} className="hover:bg-blue-400/5 transition-colors duration-200">
                        <td className="py-4 border-b border-slate-800/50 px-2">
                          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3.5 py-1.5 rounded-full text-[10px] tracking-wider font-black shrink-0 inline-block whitespace-nowrap">{grade}</span>
                        </td>
                        <td className="py-4 border-b border-slate-800/50 text-right pr-4">
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest tabular-nums">{parseInt(entry.count.toString(), 10)}</div>
                        </td>
                        <td className="py-4 border-b border-slate-800/50 text-right pr-4">
                          <div className="text-[13px] font-bold text-slate-200 tabular-nums">
                            {formatCurrency(parseFloat(entry.currentTwma.toString()), 0)}
                          </div>
                        </td>
                        <td className="py-4 border-b border-slate-800/50 text-right pr-2">
                          <div className="text-[13px] font-black text-blue-400 tabular-nums">{parseFloat(entry.multiplier.toString()).toFixed(2)}x</div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Visual Variation Grid ── */}
        <div className="mb-12">
          <div className="flex items-center gap-3 text-white mb-6">
            <TrendingUp size={22} className="text-emerald-400" />
            <h2 className="text-2xl font-black uppercase">Price Propagation per Tier</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {ACTIVE_VARIATIONS.map(name => (
              <VariationChart key={name} name={name} />
            ))}
          </div>
        </div>

        {/* ── Sales Ledger (The Truth Table) ── */}
        <SalesLedger />

        {/* ── Footer ── */}
        <footer className="pt-20 pb-10 flex flex-col md:flex-row justify-between items-center gap-6 text-slate-500 text-[11px] font-bold uppercase tracking-[0.2em] relative z-10">
          <div>Data Pipeline v3.5 (Institutional Grade) · <span className="tabular-nums">{baseData.rawKpi.totalSales + baseData.gradedKpi.totalSales}</span> Integrated Comps</div>
          <div>© 2026 Ryan Sloan Market Index · Internal Analytics</div>
        </footer>
      </div>
    </div>
  );
}

/* ───────────────────────── Sales Ledger component ───────────────────────── */

const SalesLedger = memo(function SalesLedger() {
  const [ledgerMode, setLedgerMode] = useState<"Raw" | "Graded">("Raw");
  const [selectedVariation, setSelectedVariation] = useState<string>("All");
  const [visibleItemsMap, setVisibleItemsMap] = useState<Record<string, number>>({});

  const variations = useMemo(() => {
    const keys = Object.keys(baseData.multipliers).filter(v => granularData[v]);
    return keys;
  }, []);

  const handleLoadMore = (varName: string) => {
    setVisibleItemsMap(prev => ({
      ...prev,
      [varName]: (prev[varName] || 50) + 50
    }));
  };

  return (
    <div className="flex flex-col bg-slate-900 md:bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl overflow-hidden antialiased">
      <div className="px-6 py-6 md:px-8 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center w-full gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-emerald-400">
            <LayoutGrid size={20} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Asset Ledger</span>
          </div>
          <h2 className="text-2xl font-black text-white uppercase">Verified Transaction History</h2>
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-center w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <select
              value={selectedVariation}
              onChange={(e) => setSelectedVariation(e.target.value)}
              className="w-full bg-slate-950 text-slate-200 text-xs font-bold border border-slate-800 rounded-xl px-4 py-2.5 appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 cursor-pointer uppercase tracking-widest"
            >
              <option value="All">All Variations</option>
              {variations.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
              <ChevronDown size={14} />
            </div>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0 shadow-inner w-full md:w-auto">
            <button
              onClick={() => setLedgerMode("Raw")}
              className={`flex-1 md:flex-none flex items-center justify-center px-6 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-300 ${ledgerMode === "Raw" ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`}
            >
              Raw
            </button>
            <button
              onClick={() => setLedgerMode("Graded")}
              className={`flex-1 md:flex-none flex items-center justify-center px-6 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-300 ${ledgerMode === "Graded" ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`}
            >
              Graded
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        {variations
          .filter(v => selectedVariation === "All" || v === selectedVariation)
          .map(varName => {
            const varData = granularData[varName];
            let displaySales: (Sale & { condition: string })[] = [];

            if (ledgerMode === "Raw") {
              if (varData["Raw"]) {
                displaySales = varData["Raw"].map(s => ({ ...s, condition: "Raw" }));
              }
            } else {
              displaySales = Object.entries(varData)
                .filter(([cond]) => cond !== "Raw")
                .flatMap(([cond, sales]) => sales.map(s => ({ ...s, condition: cond })));

              displaySales.sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime());
            }

            if (displaySales.length === 0) return null;

            return (
              <div key={varName} className="flex flex-col border-b border-slate-800 last:border-b-0">
                <div className="px-6 py-4 bg-slate-800/30 flex items-center justify-between border-b border-slate-800/50">
                  <div className="flex items-center gap-4">
                    <div className="w-1.5 h-4 rounded-full shrink-0 shadow-[0_0_8px_currentColor]" style={{ background: VARIATION_COLORS[varName] || '#334155', color: VARIATION_COLORS[varName] || '#334155' }} />
                    <span className={`text-[13px] font-black tracking-widest uppercase truncate ${VARIATION_TEXT_CLASSES[varName] || 'text-slate-200'}`}>{varName}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none tabular-nums shrink-0">{displaySales.length} Ledger Items</span>
                </div>
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900/60">
                        <th className="px-6 py-3 w-32 font-bold">Date</th>
                        <th className="px-6 py-3 font-bold">Listing Title</th>
                        <th className="px-6 py-3 text-center w-32 font-bold">Grade</th>
                        <th className="px-6 py-3 text-right w-40 font-bold">Settle Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displaySales.slice(0, visibleItemsMap[varName] || 50).map((sale, i) => (
                        <tr key={sale.item_id || `${varName}-${i}`} className="hover:bg-slate-800/40 transition-colors duration-200 border-b border-slate-800/50 last:border-b-0">
                          <td className="px-6 py-4 text-[11px] font-bold text-slate-400 tabular-nums">
                            {formatDateUTC(sale.sale_date, true)}
                          </td>
                          <td className="px-6 py-4">
                            <a
                              href={`https://www.ebay.com/itm/${sale.item_id}?nord=1`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-bold text-slate-300 hover:text-emerald-400 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded px-1 -mx-1 block max-w-xl truncate"
                            >
                              {sale.listing_title}
                            </a>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase whitespace-nowrap shrink-0 inline-block border tracking-wider ${sale.condition === "Raw"
                              ? "bg-slate-800 text-slate-400 border-slate-700"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                              }`}>
                              {sale.condition}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-black text-slate-200 tabular-nums">
                            {formatCurrency(parseFloat(sale.sale_price.toString()))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {displaySales.length > (visibleItemsMap[varName] || 50) && (
                  <button
                    onClick={() => handleLoadMore(varName)}
                    className="w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/5 transition-all duration-200 border-t border-slate-800/50"
                  >
                    Load More Verified Results (+50)
                  </button>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
});
