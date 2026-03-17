"use client";

import type { PlayerData, Role } from "@/types";

const ROLES: Role[] = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"];
const ROLE_COLORS: Record<Role, string> = {
  TOP: "bg-orange-600",
  JUNGLE: "bg-green-700",
  MID: "bg-blue-600",
  BOT: "bg-yellow-600",
  SUPPORT: "bg-purple-600",
};

interface Props {
  team: PlayerData[];
  teamColor: "blue" | "red";
  onRoleChange: (playerId: string, role: Role) => void;
}

export default function RoleAssignPanel({ team, teamColor, onRoleChange }: Props) {
  const assignedRoles = team.map((p) => p.assignedRole).filter(Boolean) as Role[];
  const duplicates = assignedRoles.filter((r, i) => assignedRoles.indexOf(r) !== i);

  return (
    <div className="flex flex-col gap-2">
      {team.map((player) => {
        const isDuplicate = player.assignedRole && duplicates.includes(player.assignedRole);
        return (
          <div
            key={player.id}
            className={`flex items-center gap-2 p-2 rounded-lg ${
              teamColor === "blue" ? "bg-blue-950/50" : "bg-red-950/50"
            } border ${isDuplicate ? "border-yellow-500" : "border-transparent"}`}
          >
            {/* ロールバッジ */}
            <select
              value={player.assignedRole ?? ""}
              onChange={(e) => onRoleChange(player.id, e.target.value as Role)}
              className={`text-white text-xs font-bold px-2 py-1 rounded cursor-pointer ${
                player.assignedRole ? ROLE_COLORS[player.assignedRole] : "bg-gray-600"
              }`}
            >
              <option value="">未定</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {/* プレイヤー名 */}
            <span className="text-white text-sm flex-1 truncate">{player.summonerName}</span>

            {/* ティア */}
            <span className="text-gray-400 text-xs">
              {player.tier} {player.rank}
            </span>

            {/* ムード */}
            <span className="text-xs">{["😴", "😐", "😊", "🔥"][player.mood]}</span>

            {/* ロール被り警告 */}
            {isDuplicate && (
              <span className="text-yellow-400 text-xs">⚠</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
