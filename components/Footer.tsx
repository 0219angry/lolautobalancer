export default function Footer() {
  return (
    <footer className="border-t border-wire mt-16 px-6 py-6 text-center">
      <div className="max-w-5xl mx-auto flex flex-col gap-1.5">
        <p className="font-mono text-xs text-ink-muted">
          LoL Team Balancer は Riot Games の公式ツールではありません。
        </p>
        <p className="font-mono text-xs text-ink-muted">
          League of Legends および関連するすべての商標は Riot Games, Inc. の財産です。
        </p>
        <p className="font-mono text-xs text-ink-muted mt-1">
          不具合・ご意見は Discord{" "}
          <span className="text-ink-dim">tsuyukusayu</span> までご連絡ください。
        </p>
      </div>
    </footer>
  );
}
