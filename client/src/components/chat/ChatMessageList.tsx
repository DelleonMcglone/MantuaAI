// ChatMessageList: scrollable message list with auto-scroll, skeletons, and empty state.
import React, { useEffect, useRef, useState } from "react";
import { formatDistanceToNow, isAfter, subHours } from "date-fns";
import type { Message } from "../../types/chat";
import CommandInterpretationCard from "./CommandInterpretationCard";

interface ChatMessageListProps {
  messages: Message[];
  isLoading: boolean;
  isDark?: boolean;
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
    return (
      <div
        data-testid="empty-state"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 20px",
          gap: 16,
          color: textSecondary,
          textAlign: "center",
        }}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.4}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <p style={{ margin: 0, fontSize: 15 }}>Start a conversation</p>
      </div>
    );
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
              {msg.content}
            </div>
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
