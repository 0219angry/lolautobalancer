"use client";

interface Props {
  blueScore: number;
  redScore: number;
  scoreDiff: number;
}

export default function BalanceMeter({ blueScore, redScore, scoreDiff }: Props) {
  const total = blueScore + redScore;
  const bluePercent = total > 0 ? Math.round((blueScore / total) * 100) : 50;
  const diffPercent = total > 0 ? Math.round((scoreDiff / total) * 100) : 0;

  const balanceLabel =
    diffPercent <= 5 ? "BALANCED" : diffPercent <= 15 ? "SLIGHT DIFF" : "HIGH DIFF";
  const balanceColor =
    diffPercent <= 5 ? "text-emerald-400" : diffPercent <= 15 ? "text-gold" : "text-crimson";

  return (
    <div className="border border-wire bg-surface p-5">
      {/* スコア数値 */}
      <div className="flex justify-between items-end mb-3">
        <div>
          <p className="font-mono text-sm text-azure uppercase tracking-widest mb-0.5">Blue</p>
          <p className="font-mono text-3xl font-bold text-azure">{blueScore}</p>
        </div>
        <div className="text-center">
          <p className={`font-mono text-sm uppercase tracking-widest ${balanceColor}`}>{balanceLabel}</p>
          <p className={`font-mono text-sm ${balanceColor}`}>diff {diffPercent}%</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm text-crimson uppercase tracking-widest mb-0.5">Red</p>
          <p className="font-mono text-3xl font-bold text-crimson">{redScore}</p>
        </div>
      </div>

      {/* バー */}
      <div className="flex h-2 bg-raised">
        <div
          className="bg-azure transition-all duration-700"
          style={{ width: `${bluePercent}%` }}
        />
        <div
          className="bg-crimson transition-all duration-700"
          style={{ width: `${100 - bluePercent}%` }}
        />
      </div>

      <div className="flex justify-between mt-1.5">
        <span className="font-mono text-sm text-azure-bright">{bluePercent}%</span>
        <span className="font-mono text-sm text-crimson-bright">{100 - bluePercent}%</span>
      </div>
    </div>
  );
}
