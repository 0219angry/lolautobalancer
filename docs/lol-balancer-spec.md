# LoL Custom Match Team Balancer — 仕様書

**バージョン**: 1.3.0  
**作成日**: 2026-03-17  
**更新日**: 2026-03-17 — ホスティングをVercel完結に変更（AWS不使用）  
**技術スタック**: Next.js 15 (App Router) / TypeScript / Tailwind CSS / Riot Games API v4・v5 / Vercel

---

## 1. プロダクト概要

### 1.1 目的

League of Legends のカスタムマッチにおいて、10人のプレイヤーを公平な2チームに自動分けするWebアプリケーション。  
既存ツールにない**ムード（当日コンディション）**と**フィジカル以外の貢献度（ビジョン・チームファイト参加率）**をバランス指標に組み込む点が差別化ポイント。

### 1.2 主な機能

1. サモナー名（Riot ID）入力でランク・ロール別実力を自動取得
2. ムード（当日コンディション）の手動入力
3. Riot API マッチ履歴から算出したサポート力スコアの表示・補正
4. **希望ロールの入力**（第1・第2希望を最大2件指定）
5. **結果画面でのロール手動割り当て**（各プレイヤーにどのロールで出るかを確定指定）
6. スコアに基づく自動チーム分け（希望ロールのスコアを優先使用）
7. チームバランス診断タグの表示

---

## 2. アーキテクチャ

### 2.1 全体構成

フロントエンド・バックエンドともにVercel上で完結する。Next.js の API Routes が Vercel Serverless Functions としてデプロイされるため、AWS等の別インフラは不要。

```
Vercel
├── フロントエンド（静的ビルド / Edge）
│   ├── プレイヤー入力UI
│   ├── チーム分け結果表示
│   └── バランス診断パネル
└── API Routes（Vercel Serverless Functions）
    ├── /api/summoner      — Riot ID → PUUID・ランク取得
    ├── /api/matches       — マッチ履歴 → ロール別スコア・貢献度算出
    └── /api/balance       — チーム分けアルゴリズム実行
```

**Vercel Serverless Functions の制約（Hobbyプラン）**

| 項目 | 制限値 |
|---|---|
| 実行タイムアウト | 10秒 |
| メモリ | 1024 MB |
| 月間実行回数 | 100,000回（無料枠） |
| レスポンスサイズ | 5 MB |

10人分の Riot API 呼び出しは `Promise.all` で並列化することで通常3〜5秒に収まり、タイムアウト制限内に収まる。

### 2.2 ディレクトリ構成

```
lol-balancer/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # メインUI
│   ├── globals.css
│   └── api/
│       ├── summoner/
│       │   └── route.ts            # GET /api/summoner?name=&tag=&region=
│       ├── matches/
│       │   └── route.ts            # GET /api/matches?puuid=&region=
│       └── balance/
│           └── route.ts            # POST /api/balance
├── lib/
│   ├── riot.ts                     # Riot APIクライアント
│   ├── balance.ts                  # チーム分けアルゴリズム
│   └── score.ts                    # スコア計算ロジック
├── types/
│   └── index.ts                    # 型定義
├── components/
│   ├── PlayerCard.tsx
│   ├── RoleAssignPanel.tsx         # 結果画面のロール手動確定UI
│   ├── TeamResult.tsx
│   └── BalanceMeter.tsx
├── .env.local                      # ローカル開発用（Gitにコミットしない）
└── next.config.ts
```

### 2.3 環境変数

| 変数名 | 説明 | 設定場所 |
|---|---|---|
| `RIOT_API_KEY` | Riot Games APIキー（サーバーサイド専用） | Vercel Dashboard → Settings → Environment Variables |

ローカル開発時は `.env.local` に記載。本番環境の値は Vercel Dashboard でのみ管理し、リポジトリにはコミットしない。

---

## 3. Riot API 仕様

### 3.1 使用エンドポイント

| エンドポイント | 用途 |
|---|---|
| `GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}` | Riot ID → PUUID取得 |
| `GET /lol/summoner/v4/summoners/by-puuid/{puuid}` | PUUID → サモナー情報 |
| `GET /lol/league/v4/entries/by-summoner/{summonerId}` | ランク・LP取得 |
| `GET /lol/match/v5/matches/by-puuid/{puuid}/ids` | 直近マッチIDリスト取得 |
| `GET /lol/match/v5/matches/{matchId}` | マッチ詳細取得 |

### 3.2 APIルーティング

Riot APIはエンドポイントによりホストが異なる。

| ホスト | 対象 |
|---|---|
| `https://asia.api.riotgames.com` | account/v1, match/v5（JP鯖） |
| `https://jp1.api.riotgames.com` | summoner/v4, league/v4 |

### 3.3 レート制限（Development Key）

- 20 req / 1秒
- 100 req / 2分

→ バックエンドで `Promise.all` + 逐次リトライを実装する。

---

## 4. データモデル・型定義

```typescript
// types/index.ts

// ロール
export type Role = "TOP" | "JUNGLE" | "MID" | "BOT" | "SUPPORT";

// ランクティア
export type Tier =
  | "IRON" | "BRONZE" | "SILVER" | "GOLD"
  | "PLATINUM" | "EMERALD" | "DIAMOND"
  | "MASTER" | "GRANDMASTER" | "CHALLENGER";

// ムード（当日コンディション）
export type Mood = 0 | 1 | 2 | 3; // 0=疲れ気味, 1=普通, 2=好調, 3=絶好調

// 入力プレイヤー（UI）
export interface PlayerInput {
  id: string;
  riotId: string;           // "PlayerName#JP1" 形式
  mood: Mood;
  preferredRoles: Role[];   // 希望ロール（第1・第2希望、最大2件）
}

// Riot APIから取得したプレイヤー情報
export interface PlayerData {
  id: string;
  riotId: string;
  puuid: string;
  summonerName: string;
  tier: Tier;
  rank: string;             // "I" | "II" | "III" | "IV"
  lp: number;
  preferredRoles: Role[];   // 希望ロール（手動入力）または履歴から算出した得意ロール
  roleStats: RoleStats;
  contributionScore: ContributionScore;
  mood: Mood;
  assignedRole?: Role;      // チーム分け後に確定したロール（結果画面で上書き可）
}

// ロール別スタッツ（直近20試合から算出）
export interface RoleStats {
  [role: string]: {
    games: number;
    winRate: number;        // 0.0 ~ 1.0
    avgKDA: number;
    avgCSperMin: number;
  };
}

// フィジカル以外の貢献度スコア
export interface ContributionScore {
  visionScore: number;            // 平均ビジョンスコア
  teamFightParticipation: number; // チームファイト参加率 0.0 ~ 1.0
  controlWardsBought: number;     // 平均コントロールワード購入数
  raw: number;                    // 0 ~ 100 に正規化した合成スコア
}

// チーム分けリクエスト
export interface BalanceRequest {
  players: PlayerData[];
}

// チーム分け結果
export interface BalanceResult {
  blueTeam: PlayerData[];   // assignedRole が確定済み
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
```

---

## 5. スコア計算ロジック

### 5.1 ランクスコア

```
IRON=10, BRONZE=20, SILVER=30, GOLD=40,
PLATINUM=50, EMERALD=60, DIAMOND=70,
MASTER=85, GRANDMASTER=92, CHALLENGER=100

ランク補正: IV=-0, III=+2, II=+4, I=+6
LP補正: +floor(LP / 100 * 4)  ※ Master以上は LP/100 * 6

rankScore = ティア基礎値 + ランク補正 + LP補正
```

### 5.2 ロール別実力スコア

マッチ履歴（直近20試合）から対象ロールのスタッツを取得。

```
roleScore(role) =
  winRate × 40
  + min(avgKDA / 5, 1) × 30
  + min(avgCSperMin / 10, 1) × 20
  + log(games + 1) / log(21) × 10   ← 試合数による信頼度補正

ロールの試合数が3未満の場合: rankScore × 0.8 をフォールバックとして使用
```

### 5.3 貢献度スコア（新規指標）

```
visionNorm    = min(avgVisionScore / 60, 1) × 40
tfParticipNorm = tfParticipRate × 40         ← チームファイト参加率
cwNorm        = min(avgControlWards / 2, 1) × 20

contributionScore = visionNorm + tfParticipNorm + cwNorm
```

### 5.4 ムード補正係数

```
mood 0（疲れ気味）: × 0.75
mood 1（普通）    : × 1.00
mood 2（好調）    : × 1.15
mood 3（絶好調）  : × 1.30
```

### 5.5 プレイヤー総合スコア

希望ロールが指定されている場合、そのロールの `roleScore` を優先使用する。

```
// 使用するロールスコアの決定
effectiveRole =
  assignedRole          // 1. 確定ロール（結果画面で上書きされた場合）
  ?? preferredRoles[0]  // 2. 希望ロール第1希望（手動入力 or 履歴から算出）

effectiveRoleScore = roleScore(effectiveRole)

totalScore = (rankScore × 0.4 + effectiveRoleScore × 0.35 + contributionScore × 0.25)
             × moodMultiplier
```

---

## 6. チーム分けアルゴリズム

### 6.1 方針

1. **希望ロール優先**: `preferredRoles[0]` をそのプレイヤーの第1希望ロールとして扱う
2. **ロール最適配置**: 各チームで5ロールが揃うよう配置し、スコアを均等化
3. **スコア差最小化**: 5v5の合計スコア差を最小にする
4. **ロール被り最小化**: 同ロール希望者が同チームに偏らないよう調整
5. **ロール手動確定の優先**: 結果画面で `assignedRole` が設定されたプレイヤーはロール固定

### 6.2 手順

```
Step 1: 各プレイヤーのtotalScoreを計算
  - preferredRoles[0] のロールの roleScore を使用
  - preferredRoles が空の場合は全ロール平均でフォールバック

Step 2: ロールグループ分け
  - assignedRole（手動確定）> preferredRoles[0]（第1希望）の優先度でロール決定
  - 同ロール希望者が多い場合は preferredRoles[1]（第2希望）で再分配

Step 3: ロールペアリング
  各ロールで上位2名を抽出 → 強い方をBlue/Red交互に割り当て

Step 4: 残余プレイヤーの割り当て
  未割り当てプレイヤーをスコアの低いチームに順次追加

Step 5: 最終調整（スコア差 > 閾値の場合）
  両チームで交換候補をブルートフォース探索し、
  差が縮まる交換を1回だけ適用
  ※ assignedRole が設定されたプレイヤーはロール固定のため交換対象から除外

Step 6: assignedRole の確定
  各プレイヤーに effectiveRole を assignedRole として書き込む
```

### 6.3 診断タグ生成ルール

| 条件 | タグ種別 | メッセージ例 |
|---|---|---|
| 全5ロール揃い | ok | 「全ロール揃い」 |
| ロール不足 | warn | 「Midなし」 |
| スコア差 ≤ 5% | ok | 「バランス良好」 |
| スコア差 > 15% | warn | 「スコア差大きめ」 |
| 平均ムード ≥ 2.0 | ok | 「チーム士気高め」 |
| 平均ムード < 1.0 | warn | 「チーム士気低め」 |
| 平均貢献度スコア ≥ 60 | ok | 「サポート力充実」 |

---

## 7. API Routes 仕様

### 7.1 GET /api/summoner

**クエリパラメータ**

| パラメータ | 型 | 説明 |
|---|---|---|
| `name` | string | ゲーム名（`#`より前） |
| `tag` | string | タグライン（`#`より後） |
| `region` | string | `jp1`（デフォルト） |

**レスポンス（200）**

```json
{
  "puuid": "...",
  "tier": "GOLD",
  "rank": "II",
  "lp": 45,
  "summonerName": "PlayerName"
}
```

**エラー**

| コード | 原因 |
|---|---|
| 404 | サモナーが見つからない |
| 429 | レート制限超過 |
| 500 | Riot API障害 |

### 7.2 GET /api/matches

**クエリパラメータ**

| パラメータ | 型 | 説明 |
|---|---|---|
| `puuid` | string | プレイヤーPUUID |
| `region` | string | `asia`（デフォルト） |
| `count` | number | 取得試合数（デフォルト20、最大20） |

**レスポンス（200）**

```json
{
  "roleStats": {
    "MID": { "games": 12, "winRate": 0.58, "avgKDA": 3.2, "avgCSperMin": 7.8 }
  },
  "preferredRoles": ["MID", "TOP"],
  "contributionScore": {
    "visionScore": 24.5,
    "teamFightParticipation": 0.72,
    "controlWardsBought": 1.3,
    "raw": 68
  }
}
```

### 7.3 POST /api/balance

**リクエストボディ**

```json
{
  "players": [
    {
      "...": "PlayerData",
      "preferredRoles": ["BOT", "MID"],
      "assignedRole": null
    }
  ]
}
```

`assignedRole` が `null` の場合はアルゴリズムが自動決定。非 `null` の場合はそのロールに固定。

**レスポンス（200）**

```json
{
  "blueTeam": [
    {
      "...": "PlayerData",
      "assignedRole": "BOT",
      "preferredRoles": ["BOT", "MID"]
    }
  ],
  "redTeam": [ "..." ],
  "blueScore": 342,
  "redScore":  338,
  "scoreDiff": 4,
  "diagnostics": [
    { "team": "blue", "type": "ok",   "message": "全ロール揃い" },
    { "team": "red",  "type": "warn", "message": "Supportなし" }
  ]
}
```

---

## 8. UIフロー

### 8.1 画面構成

```
[1] プレイヤー入力画面
  - 10枠のプレイヤーカード
  - 各カード:
      Riot ID入力 → 「取得」ボタン → ランク・ロール自動表示
      ムード選択（😴/😐/😊/🔥）
      希望ロール選択（第1希望・第2希望をドロップダウンで指定）
      手動モード: ランク・サポート力スライダーで直接入力も可

[2] チーム分け結果画面
  - Blue / Red チーム表示
  - 各プレイヤー行:
      ロールバッジ（assignedRole）← ドロップダウンで変更可能
      ランク・ムード・スコア
  - [ロール再確定ボタン] 全員のロールを手動確定後、再スコア計算
  - バランスメーター（スコア比率バー）
  - 診断タグ一覧
  - 「再シャッフル」ボタン（ランダム性を加えた再計算）
```

### 8.2 UX詳細

- Riot ID入力後 Enter またはフォーカスアウトで自動フェッチ
- フェッチ中はカードにスケルトンローディング表示
- API取得失敗時は手動入力モードに自動切替（エラートースト表示）
- 10人全員のデータが揃った時点で「チームを分ける」ボタンが活性化
- 希望ロールはマッチ履歴取得後に得意ロールを初期値として自動セット（上書き可）
- 結果画面のロールドロップダウン変更時は即座にスコアを再計算して表示を更新
- ロール変更によりチーム内でロール被りが発生した場合は警告トーストを表示
- スマートフォン対応（レスポンシブ）

---

## 9. エラーハンドリング

| ケース | 対応 |
|---|---|
| サモナーが見つからない | 「プレイヤーが見つかりません」トースト + 手動入力に切替 |
| Riot APIレート制限 | 自動リトライ（最大3回、指数バックオフ） |
| マッチ履歴が少ない（<3試合） | rankScoreベースのフォールバックを使用 |
| ネットワークエラー | エラーバナー表示 + 再試行ボタン |

---

## 10. 開発ステップ

```
Phase 1 — 基盤構築
  [ ] Next.jsプロジェクト作成
  [ ] 型定義 (types/index.ts) — preferredRoles・assignedRole を含む
  [ ] lib/riot.ts — Riot APIクライアント実装
  [ ] .env.local — APIキー設定

Phase 2 — バックエンド
  [ ] GET /api/summoner 実装・テスト
  [ ] GET /api/matches 実装・テスト
  [ ] lib/score.ts — スコア計算ロジック（effectiveRole 対応）
  [ ] lib/balance.ts — チーム分けアルゴリズム（assignedRole 固定対応）
  [ ] POST /api/balance 実装・テスト

Phase 3 — フロントエンド
  [ ] PlayerCard コンポーネント（希望ロール選択ドロップダウン含む）
  [ ] RoleAssignPanel コンポーネント（結果画面のロール手動確定）
  [ ] TeamResult コンポーネント（assignedRole ドロップダウン付き）
  [ ] BalanceMeter コンポーネント
  [ ] app/page.tsx — メインUI組み上げ

Phase 4 — デプロイ・仕上げ
  [ ] レスポンシブ対応
  [ ] エラーハンドリング全体
  [ ] レート制限リトライ実装
  [ ] Vercel へデプロイ（git push で自動デプロイ）
  [ ] Vercel Dashboard で RIOT_API_KEY を環境変数に設定
```

---

## 11. セットアップ・デプロイ手順

### 11.1 ローカル開発

```bash
# 1. プロジェクト作成
npx create-next-app@latest lol-balancer --typescript --app --tailwind
cd lol-balancer

# 2. 環境変数設定（ローカル用）
echo "RIOT_API_KEY=RGAPI-xxxx-xxxx" > .env.local

# 3. 開発サーバー起動
npm run dev
```

### 11.2 Vercel へのデプロイ

```bash
# 1. Vercel CLI インストール（初回のみ）
npm i -g vercel

# 2. GitHubリポジトリにプッシュ
git init && git add . && git commit -m "init"
git remote add origin https://github.com/yourname/lol-balancer.git
git push -u origin main

# 3. Vercel にプロジェクトをインポート
#    https://vercel.com/new からリポジトリを選択してデプロイ
```

### 11.3 本番環境変数の設定

Vercel Dashboard → プロジェクト → Settings → Environment Variables に以下を追加。

| 変数名 | 値 | 環境 |
|---|---|---|
| `RIOT_API_KEY` | `RGAPI-xxxx-xxxx` | Production / Preview / Development |

> **注意**: `.env.local` は `.gitignore` に含まれており、リポジトリにはコミットされない。本番の API キーは必ず Vercel Dashboard で管理すること。

### 11.4 Riot API キーについて

- Development Key: [developer.riotgames.com](https://developer.riotgames.com) で即時取得可能。ただし24時間で失効し、呼び出し元IPに制限あり。
- Production Key: 公開運用する場合は Riot Games への申請が必要（審査あり）。
- Vercel の Serverless Functions は実行のたびにIPが変わるため、Development Key では本番運用不可。**公開前に Production Key を取得すること。**

---

## 12. 参考リンク

- [Riot Developer Portal](https://developer.riotgames.com)
- [Riot API ドキュメント](https://developer.riotgames.com/apis)
- [Match v5 レスポンス仕様](https://developer.riotgames.com/apis#match-v5)
- [Next.js App Router ドキュメント](https://nextjs.org/docs/app)
- [Vercel デプロイドキュメント](https://vercel.com/docs/deployments/overview)
- [Vercel 環境変数ドキュメント](https://vercel.com/docs/environment-variables)
