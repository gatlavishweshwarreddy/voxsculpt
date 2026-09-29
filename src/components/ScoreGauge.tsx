import type { ReleaseReport } from "@/types/analysis";

interface ScoreGaugeProps {
  report: ReleaseReport;
}

function getScoreColor(score: number): { stroke: string; text: string; bg: string } {
  if (score >= 75) return { stroke: "#22c55e", text: "text-green-400", bg: "bg-green-500/10" };
  if (score >= 50) return { stroke: "#f59e0b", text: "text-amber-400", bg: "bg-amber-500/10" };
  return { stroke: "#ef4444", text: "text-red-400", bg: "bg-red-500/10" };
}

function getRecommendationStyle(rec: ReleaseReport["recommendation"]) {
  if (rec === "SAFE") return { bg: "bg-green-500/15 border-green-500/40", text: "text-green-300", dot: "bg-green-400" };
  if (rec === "CAUTION") return { bg: "bg-amber-500/15 border-amber-500/40", text: "text-amber-300", dot: "bg-amber-400" };
  return { bg: "bg-red-500/15 border-red-500/40", text: "text-red-300", dot: "bg-red-400" };
}

export default function ScoreGauge({ report }: ScoreGaugeProps) {
  const { safetyScore, recommendation, dimensions } = report;
  const { stroke, text } = getScoreColor(safetyScore);
  const recStyle = getRecommendationStyle(recommendation);

  // SVG circle gauge
  const size = 180;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (safetyScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Circle gauge */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-bold ${text}`}>{safetyScore}</span>
          <span className="text-xs text-slate-500 font-medium tracking-wide uppercase mt-0.5">/ 100</span>
        </div>
      </div>

      {/* Recommendation badge */}
      <div className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full border ${recStyle.bg}`}>
        <span className={`w-2.5 h-2.5 rounded-full ${recStyle.dot} animate-pulse`} />
        <span className={`font-bold text-lg tracking-wide ${recStyle.text}`}>
          {recommendation}
        </span>
      </div>

      {/* Score summary text */}
      <p className="text-slate-400 text-sm text-center max-w-xs leading-relaxed">
        {report.summary}
      </p>

      {/* Dimension bars */}
      <div className="w-full space-y-3 pt-2">
        {dimensions.map((dim) => {
          const { stroke: dStroke, text: dText } = getScoreColor(dim.score);
          return (
            <div key={dim.name}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-400">{dim.label}</span>
                <span className={`text-xs font-semibold ${dText}`}>{dim.score}</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${dim.score}%`, backgroundColor: dStroke }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
