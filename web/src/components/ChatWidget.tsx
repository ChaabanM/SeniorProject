"use client";

import { useMemo, useState } from "react";

type ChatFilters = {
  start?: string;
  end?: string;
  locationId?: string;
  categoryId?: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatWidget(props: { filters: ChatFilters }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Ask me about stockouts, reorder risk, expiry risk, consumption, or movement for the selected filters.",
    },
  ]);
  const [busy, setBusy] = useState(false);

  const canSend = useMemo(() => input.trim().length > 0 && !busy, [input, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const history = messages
        .filter((m) => m.content && !m.content.startsWith("Error:"))
        .slice(-20);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          filters: props.filters,
          history,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error ?? "Chat request failed.");
      setMessages((prev) => [...prev, { role: "assistant", content: payload.reply }]);
    } catch (e: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${e instanceof Error ? e.message : "Unknown error"}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="w-[360px] overflow-hidden rounded-2xl border border-[color:var(--border-color)] bg-[var(--card-bg)] shadow-card">
          <div className="flex items-center justify-between bg-[var(--surface-bg)] px-4 py-3">
            <div className="text-sm font-semibold text-[color:var(--text-main)]">
              Inventory Assistant
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-[color:var(--text-muted)] hover:bg-[var(--card-bg)]"
              type="button"
            >
              Close
            </button>
          </div>

          <div className="max-h-[360px] space-y-3 overflow-auto px-4 py-3 text-sm">
            {messages.map((m, idx) => (
              <div key={idx} className={m.role === "user" ? "text-right" : "text-left"}>
                <div
                  className={
                    m.role === "user"
                      ? "inline-block max-w-[90%] rounded-2xl bg-[var(--accent)] px-3 py-2 text-white"
                      : "inline-block max-w-[90%] rounded-2xl bg-[var(--surface-bg)] px-3 py-2 text-[color:var(--text-main)]"
                  }
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-[color:var(--border-color)] bg-[var(--card-bg)] p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
                placeholder={busy ? "Thinking..." : "Ask a question..."}
                className="flex-1 rounded-xl bg-[var(--surface-bg)] px-3 py-2 text-sm text-[color:var(--text-main)] outline-none"
                disabled={busy}
              />
              <button
                onClick={send}
                disabled={!canSend}
                className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                type="button"
              >
                Send
              </button>
            </div>
            <div className="mt-2 text-[11px] text-[color:var(--text-muted)]">
              Uses the active dashboard filters for data-aware answers.
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-card hover:bg-[var(--accent-hover)]"
          type="button"
        >
          Chat
        </button>
      )}
    </div>
  );
}

