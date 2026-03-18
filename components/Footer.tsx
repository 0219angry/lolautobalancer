"use client";

import { useState } from "react";

export default function Footer() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText("tsuyukusayu").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

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
          <button
            onClick={handleCopy}
            title="クリックしてコピー"
            className="text-ink-dim hover:text-ink transition-colors underline decoration-dotted cursor-pointer"
          >
            {copied ? "コピーしました!" : "tsuyukusayu"}
          </button>
          {" "}までご連絡ください。
        </p>
      </div>
    </footer>
  );
}
