// ロール
export type Role = "TOP" | "JUNGLE" | "MID" | "BOT" | "SUPPORT";

// ランクティア
export type Tier =
  | "IRON"
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "EMERALD"
  | "DIAMOND"
  | "MASTER"
  | "GRANDMASTER"
  | "CHALLENGER";

// ムード（当日コンディション）
export type Mood = 0 | 1 | 2 | 3; // 0=疲れ気味, 1=普通, 2=好調, 3=絶好調

// 入力プレイヤー（UI）
export interface PlayerInput {
  id: string;
  riotId: string; // "PlayerName#JP1" 形式
  mood: Mood;
  preferredRoles: Role[]; // 希望ロール（第1・第2希望、最大2件）
}

// ロール別スタッツ（直近20試合から算出）
export interface RoleStats {
  [role: string]: {
    games: number;
    winRate: number; // 0.0 ~ 1.0
    avgKDA: number;
    avgCSperMin: number;
  };
}

// フィジカル以外の貢献度スコア
export interface ContributionScore {
  visionScore: number; // 平均ビジョンスコア
  teamFightParticipation: number; // チームファイト参加率 0.0 ~ 1.0
  controlWardsBought: number; // 平均コントロールワード購入数
  raw: number; // 0 ~ 100 に正規化した合成スコア
}

// Riot APIから取得したプレイヤー情報
export interface PlayerData {
  id: string;
  riotId: string;
  puuid: string;
  summonerName: string;
  tier: Tier;
  rank: string; // "I" | "II" | "III" | "IV"
  lp: number;
  preferredRoles: Role[]; // 希望ロール（手動入力）または履歴から算出した得意ロール
  roleStats: RoleStats;
  contributionScore: ContributionScore;
  mood: Mood;
  assignedRole?: Role; // チーム分け後に確定したロール（結果画面で上書き可）
}

// チーム分けリクエスト
export interface BalanceRequest {
  players: PlayerData[];
}

// チーム分け結果
export interface BalanceResult {
  blueTeam: PlayerData[]; // assignedRole が確定済み
  redTeam: PlayerData[];
  blueScore: number;
  redScore: number;
  scoreDiff: number;
  diagnostics: Diagnostic[];
}

// 診断タグ
export interface Diagnostic {
  team: "blue" | "red" | "both";
  type: "ok" | "warn";
  message: string;
}
