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
    <div className="flex flex-col gap-4">
      {/* バランスメーター */}
      <BalanceMeter blueScore={blueScore} redScore={redScore} scoreDiff={scoreDiff} />

      {/* 診断 */}
      {diagnostics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {diagnostics.map((d, i) => (
            <span
              key={i}
              className={`font-mono text-xs px-2 py-0.5 border ${
                d.type === "ok"
                  ? "border-emerald-800 text-emerald-400"
                  : "border-gold-dim text-gold"
              }`}
            >
              {d.type === "ok" ? "OK" : "!"}{" "}
              {d.team === "blue" ? "B " : d.team === "red" ? "R " : ""}
              {d.message}
            </span>
          ))}
        </div>
      )}

      {/* チーム表示 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-wire">
        {/* Blue チーム */}
        <div className="bg-surface">
          <div className="px-3 py-2 border-b border-wire flex items-center gap-2">
            <span className="w-2 h-2 bg-azure flex-shrink-0" />
            <span className="font-mono text-xs text-azure uppercase tracking-widest">Blue Side</span>
          </div>
          <RoleAssignPanel
            team={blueTeam}
            teamColor="blue"
            onRoleChange={(id, role) => onRoleChange("blue", id, role)}
          />
        </div>

        {/* Red チーム */}
        <div className="bg-surface">
          <div className="px-3 py-2 border-b border-wire flex items-center gap-2">
            <span className="w-2 h-2 bg-crimson flex-shrink-0" />
            <span className="font-mono text-xs text-crimson uppercase tracking-widest">Red Side</span>
          </div>
          <RoleAssignPanel
            team={redTeam}
            teamColor="red"
            onRoleChange={(id, role) => onRoleChange("red", id, role)}
          />
        </div>
      </div>

      {/* アクションボタン */}
      <div className="flex gap-3">
        <button
          onClick={onReconfirm}
          className="border border-wire-bright text-ink text-xs font-mono px-4 py-2 hover:border-gold hover:text-gold transition-colors"
        >
          ロール再確定 → 再計算
        </button>
        <button
          onClick={onReshuffle}
          className="border border-wire text-ink-dim text-xs font-mono px-4 py-2 hover:border-wire-bright hover:text-ink transition-colors"
        >
          再シャッフル
        </button>
      </div>
    </div>
  );
}
