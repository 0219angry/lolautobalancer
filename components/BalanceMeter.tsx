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
    diffPercent <= 5 ? "バランス良好" : diffPercent <= 15 ? "やや差あり" : "スコア差大";
  const balanceColor =
    diffPercent <= 5 ? "text-green-400" : diffPercent <= 15 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <span className="text-blue-400 font-bold text-sm">BLUE {blueScore}</span>
        <span className={`text-xs font-bold ${balanceColor}`}>{balanceLabel} (差 {diffPercent}%)</span>
        <span className="text-red-400 font-bold text-sm">{redScore} RED</span>
      </div>

      {/* バーグラフ */}
      <div className="flex h-4 rounded-full overflow-hidden">
        <div
          className="bg-blue-500 transition-all duration-500"
          style={{ width: `${bluePercent}%` }}
        />
        <div
          className="bg-red-500 transition-all duration-500"
          style={{ width: `${100 - bluePercent}%` }}
        />
      </div>

      <div className="flex justify-between mt-1">
        <span className="text-blue-300 text-xs">{bluePercent}%</span>
        <span className="text-red-300 text-xs">{100 - bluePercent}%</span>
      </div>
    </div>
  );
}
