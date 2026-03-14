// ChatMessageList: scrollable message list with auto-scroll, skeletons, and empty state.
import React, { useEffect, useRef, useState, useMemo } from "react";
import { formatDistanceToNow, isAfter, subHours } from "date-fns";
import type { Message } from "../../types/chat";
import CommandInterpretationCard from "./CommandInterpretationCard";
import { ChartMessage } from "../analytics/ChartMessage";
import { DuneResultTable } from "../DuneResultTable";

/**
 * Renders message content with:
 *  - URLs converted to clickable links
 *  - **bold** text rendered as <strong>
 *  - Newlines preserved
 */
function RichContent({ text, linkColor }: { text: string; linkColor: string }) {
  const parts = useMemo(() => {
    // Split on URLs, bold markers, and newlines
    const urlRe = /(https?:\/\/[^\s)]+)/g;
    const boldRe = /\*\*(.+?)\*\*/g;

    // First pass: split by lines
    return text.split('\n').map((line, lineIdx) => {
      // Replace bold markers, then split on URLs
      const segments: React.ReactNode[] = [];
      // Combined regex: match URLs or bold
      const combined = /(\*\*(.+?)\*\*|https?:\/\/[^\s)]+)/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = combined.exec(line)) !== null) {
        // Text before this match
        if (match.index > lastIndex) {
          segments.push(line.slice(lastIndex, match.index));
        }
        if (match[0].startsWith('**')) {
          // Bold text
          segments.push(<strong key={`b-${lineIdx}-${match.index}`}>{match[2]}</strong>);
        } else {
          // URL
          segments.push(
            <a
              key={`a-${lineIdx}-${match.index}`}
              href={match[0]}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: linkColor, textDecoration: 'underline', wordBreak: 'break-all' }}
            >
              {match[0]}
            </a>
          );
        }
        lastIndex = match.index + match[0].length;
      }
      // Remaining text
      if (lastIndex < line.length) {
        segments.push(line.slice(lastIndex));
      }

      return (
        <React.Fragment key={lineIdx}>
          {lineIdx > 0 && <br />}
          {segments.length > 0 ? segments : line}
        </React.Fragment>
      );
    });
  }, [text, linkColor]);

  return <>{parts}</>;
}

interface ChatMessageListProps {
  messages: Message[];
  isLoading: boolean;
  isDark?: boolean;
  theme?: any;
}

function formatTime(iso: string): string {
  try {
    const date = new Date(iso);
    if (isAfter(date, subHours(new Date(), 24))) {
      return formatDistanceToNow(date, { addSuffix: true });
    }
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function SkeletonBubble({ align }: { align: "left" | "right" }) {
  return (
    <div
      aria-hidden="true"
      style={{
        alignSelf: align === "right" ? "flex-end" : "flex-start",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        width: "60%",
        maxWidth: 360,
      }}
    >
      <div
        style={{
          height: 14,
          width: "40%",
          borderRadius: 6,
          background: "rgba(148,163,184,0.2)",
          animation: "shimmer 1.4s ease-in-out infinite",
        }}
      />
      <div
        style={{
          height: 44,
          borderRadius: 12,
          background: "rgba(148,163,184,0.15)",
          animation: "shimmer 1.4s ease-in-out infinite",
        }}
      />
    </div>
  );
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  isLoading,
  isDark = true,
  theme = {},
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // Detect if the user has scrolled up
  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 80;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setUserScrolledUp(!isAtBottom);
  }

  // Auto-scroll to bottom when new messages arrive, unless user scrolled up
  useEffect(() => {
    if (!userScrolledUp && bottomRef.current?.scrollIntoView) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, userScrolledUp]);

  const textPrimary = isDark ? "#f1f5f9" : "#0f172a";
  const textSecondary = isDark ? "#94a3b8" : "#64748b";
  const userBg = isDark ? "rgba(139,92,246,0.18)" : "rgba(139,92,246,0.1)";
  const assistantBg = isDark ? "#1e293b" : "#f8fafc";
  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "24px 0" }}>
        <SkeletonBubble align="right" />
        <SkeletonBubble align="left" />
        <SkeletonBubble align="right" />
        <style>{`@keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </div>
    );
  }

  if (messages.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      {messages.map((msg) => {
        const isUser = msg.role === "user";
        return (
          <div
            key={msg.id}
            data-testid={`message-${msg.role}`}
            style={{
              alignSelf: isUser ? "flex-end" : "flex-start",
              maxWidth: "80%",
              display: "flex",
              flexDirection: "column",
              alignItems: isUser ? "flex-end" : "flex-start",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 11, color: textSecondary, marginBottom: 2 }}>
              {isUser ? "You" : "Mantua"}
            </span>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                background: isUser ? userBg : assistantBg,
                border: `1px solid ${borderColor}`,
                color: textPrimary,
                fontSize: 14,
                lineHeight: 1.6,
                wordBreak: "break-word",
              }}
            >
              <RichContent text={msg.content} linkColor={isDark ? '#93c5fd' : '#2563eb'} />
            </div>
            {msg.chart && (
              <ChartMessage
                title={msg.chart.title}
                description={msg.chart.description}
                chartType={msg.chart.chartType}
                data={msg.chart.data}
                isLoading={msg.chart.isLoading ?? false}
                error={msg.chart.error ?? null}
                theme={theme}
                isDark={isDark}
              />
            )}
            {msg.dune && (
              msg.dune.isLoading ? (
                <div style={{ padding: '12px 16px', borderRadius: 10, background: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', fontSize: 13 }}>
                  🟡 Querying Dune Analytics...
                </div>
              ) : msg.dune.error ? (
                <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 13 }}>
                  {msg.dune.error}
                </div>
              ) : (
                <DuneResultTable data={msg.dune} isDark={isDark} />
              )
            )}
            {msg.metadata?.command && (
              <CommandInterpretationCard command={msg.metadata.command} isDark={isDark} />
            )}
            <span style={{ fontSize: 11, color: textSecondary, opacity: 0.7 }}>
              {formatTime(msg.createdAt)}
            </span>
          </div>
        );
      })}
      <div ref={bottomRef} style={{ height: 1 }} />
    </div>
  );
};

export default ChatMessageList;
