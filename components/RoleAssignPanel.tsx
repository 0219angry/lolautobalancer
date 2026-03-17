"use client";

import type { PlayerData, Role } from "@/types";

const ROLES: Role[] = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"];
const ROLE_SHORT: Record<Role, string> = {
  TOP: "TOP", JUNGLE: "JGL", MID: "MID", BOT: "BOT", SUPPORT: "SUP",
};
const MOOD_SHORT = ["疲", "普", "好", "熱"];

interface Props {
  team: PlayerData[];
  teamColor: "blue" | "red";
  onRoleChange: (playerId: string, role: Role) => void;
}

export default function RoleAssignPanel({ team, teamColor, onRoleChange }: Props) {
  const assignedRoles = team.map((p) => p.assignedRole).filter(Boolean) as Role[];
  const duplicates = assignedRoles.filter((r, i) => assignedRoles.indexOf(r) !== i);

  return (
    <div className="flex flex-col divide-y divide-wire">
      {team.map((player) => {
        const isDuplicate = player.assignedRole && duplicates.includes(player.assignedRole);
        const rowBg = teamColor === "blue" ? "bg-azure-dim" : "bg-crimson-dim";

        return (
          <div
            key={player.id}
            className={`flex items-center gap-2 px-4 py-3 ${rowBg} ${isDuplicate ? "border-l-2 border-l-gold" : ""}`}
          >
            {/* ロール選択 */}
            <select
              value={player.assignedRole ?? ""}
              onChange={(e) => onRoleChange(player.id, e.target.value as Role)}
              className={`bg-transparent font-mono text-sm px-2 py-1 border focus:outline-none w-16 flex-shrink-0 ${
                player.assignedRole
                  ? teamColor === "blue"
                    ? "border-azure text-azure"
                    : "border-crimson text-crimson"
                  : "border-wire text-ink-dim"
              }`}
            >
              <option value="">—</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_SHORT[r]}</option>
              ))}
            </select>

            {/* プレイヤー名 */}
            <span className="text-ink text-sm flex-1 truncate">{player.summonerName}</span>

            {/* ティア */}
            <span className="font-mono text-sm text-ink-dim flex-shrink-0">
              {player.tier.slice(0, 2)} {player.rank}
            </span>

            {/* ムード */}
            <span className={`font-mono text-sm flex-shrink-0 ${
              player.mood === 3 ? "text-gold" : player.mood === 0 ? "text-ink-muted" : "text-ink-dim"
            }`}>
              {MOOD_SHORT[player.mood]}
            </span>

            {/* 重複警告 */}
            {isDuplicate && (
              <span className="font-mono text-sm text-gold flex-shrink-0">!</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
