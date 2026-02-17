// CommandInterpretationCard: shows a structured DeFi command detected in an AI response.
import React from "react";
import type { SwapCommand, LiquidityCommand } from "../../types/chat";

type Command = SwapCommand | LiquidityCommand;

interface CommandInterpretationCardProps {
  command: Command;
  isDark?: boolean;
}

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  swap: { bg: "#8b5cf6", text: "#ffffff" },
  liquidity: { bg: "#10b981", text: "#ffffff" },
};

const HOOK_LABELS: Record<string, string> = {
  "stable-protection": "Stable Protection",
  jit: "JIT Rebalancing",
  "mev-protection": "MEV Protection",
};

export const CommandInterpretationCard: React.FC<CommandInterpretationCardProps> = ({
  command,
  isDark = true,
}) => {
  const badge = BADGE_COLORS[command.type] ?? { bg: "#6b7280", text: "#fff" };
  const cardBg = isDark ? "rgba(139,92,246,0.08)" : "rgba(139,92,246,0.05)";
  const border = isDark ? "rgba(139,92,246,0.25)" : "rgba(139,92,246,0.2)";
  const textPrimary = isDark ? "#e2e8f0" : "#1e293b";
  const textMuted = isDark ? "#94a3b8" : "#64748b";

  function renderDetails() {
    if (command.type === "swap") {
      const s = command as SwapCommand;
      return (
        <span>
          From: <strong style={{ color: textPrimary }}>{s.fromToken}</strong> →{" "}
          To: <strong style={{ color: textPrimary }}>{s.toToken}</strong> | Amount:{" "}
          <strong style={{ color: textPrimary }}>{s.amount}</strong>
          {s.hook && (
            <>
              {" "}| Hook:{" "}
              <strong style={{ color: textPrimary }}>{HOOK_LABELS[s.hook] ?? s.hook}</strong>
            </>
          )}
        </span>
      );
    }
    const l = command as LiquidityCommand;
    return (
      <span>
        Action: <strong style={{ color: textPrimary }}>{l.action === "add" ? "Add" : "Remove"}</strong> |
        Pair: <strong style={{ color: textPrimary }}>{l.token0}/{l.token1}</strong>
        {l.hook && (
          <>
            {" "}| Hook:{" "}
            <strong style={{ color: textPrimary }}>{HOOK_LABELS[l.hook] ?? l.hook}</strong>
          </>
        )}
      </span>
    );
  }

  return (
    <div
      data-testid="command-card"
      style={{
        marginTop: 8,
        padding: "10px 14px",
        background: cardBg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        fontSize: 13,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 4,
            background: badge.bg,
            color: badge.text,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {command.type}
        </span>
      </div>
      <div style={{ color: textMuted, lineHeight: 1.5 }}>{renderDetails()}</div>
      <div style={{ marginTop: 8, fontSize: 11, color: textMuted, fontStyle: "italic" }}>
        Interpreted from your message
      </div>
    </div>
  );
};

export default CommandInterpretationCard;
