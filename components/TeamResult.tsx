"use client";

import type { BalanceResult, PlayerData, Role, Diagnostic } from "@/types";
import BalanceMeter from "./BalanceMeter";
import RoleAssignPanel from "./RoleAssignPanel";

interface Props {
  result: BalanceResult;
  onRoleChange: (team: "blue" | "red", playerId: string, role: Role) => void;
  onReconfirm: () => void;
  onReshuffle: () => void;
}

export default function TeamResult({ result, onRoleChange, onReconfirm, onReshuffle }: Props) {
  const { blueTeam, redTeam, blueScore, redScore, scoreDiff, diagnostics } = result;

  return (
    <div className="flex flex-col gap-6">
      {/* バランスメーター */}
      <BalanceMeter blueScore={blueScore} redScore={redScore} scoreDiff={scoreDiff} />

      {/* 診断タグ */}
      <DiagnosticTags diagnostics={diagnostics} />

      {/* チーム表示 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Blue チーム */}
        <div className="bg-gray-800 rounded-xl p-4 border border-blue-700">
          <h3 className="text-blue-400 font-bold text-lg mb-3">🔵 BLUE TEAM</h3>
          <RoleAssignPanel
            team={blueTeam}
            teamColor="blue"
            onRoleChange={(id, role) => onRoleChange("blue", id, role)}
          />
        </div>

        {/* Red チーム */}
        <div className="bg-gray-800 rounded-xl p-4 border border-red-700">
          <h3 className="text-red-400 font-bold text-lg mb-3">🔴 RED TEAM</h3>
          <RoleAssignPanel
            team={redTeam}
            teamColor="red"
            onRoleChange={(id, role) => onRoleChange("red", id, role)}
          />
        </div>
      </div>

      {/* アクションボタン */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={onReconfirm}
          className="bg-green-700 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-bold transition-colors"
        >
          ロール再確定 → 再計算
        </button>
        <button
          onClick={onReshuffle}
          className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2 rounded-lg font-bold transition-colors"
        >
          再シャッフル
        </button>
      </div>
    </div>
  );
}

function DiagnosticTags({ diagnostics }: { diagnostics: Diagnostic[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {diagnostics.map((d, i) => (
        <span
          key={i}
          className={`text-xs px-3 py-1 rounded-full font-medium ${
            d.type === "ok"
              ? "bg-green-900/60 text-green-300 border border-green-700"
              : "bg-yellow-900/60 text-yellow-300 border border-yellow-700"
          }`}
        >
          {d.type === "ok" ? "✓" : "⚠"}{" "}
          {d.team === "blue" ? "🔵 " : d.team === "red" ? "🔴 " : ""}
          {d.message}
        </span>
      ))}
    </div>
  );
}
