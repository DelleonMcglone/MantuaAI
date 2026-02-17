// useChat: manages userId identity, session lifecycle, and message persistence.
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "./use-toast";
import type {
  Message,
  CreateSessionResponse,
  SessionsResponse,
  MessagesResponse,
  CreateMessageResponse,
  AiChatResponse,
} from "../types/chat";

const USER_ID_KEY = "mantua_user_id";
const AI_ENDPOINT = "/api/ai/chat";

function getOrCreateUserId(): string {
  const stored = localStorage.getItem(USER_ID_KEY);
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem(USER_ID_KEY, id);
  return id;
}

export interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  isSending: boolean;
  sendMessage: (text: string) => Promise<void>;
  sessionId: string | null;
  userId: string;
}

export function useChat(): UseChatReturn {
  const [userId] = useState<string>(getOrCreateUserId);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  // Keep ref in sync so sendMessage always has latest sessionId
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // On mount: fetch or create the user's default session
  useEffect(() => {
    let cancelled = false;
    async function init() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/chat/sessions/${userId}`);
        if (!res.ok) throw new Error("Failed to fetch sessions");
        const data: SessionsResponse = await res.json();

        if (cancelled) return;

        if (data.sessions.length > 0) {
          const latest = data.sessions[0];
          setSessionId(latest.id);
          sessionIdRef.current = latest.id;
          // Load existing messages
          const msgRes = await fetch(`/api/chat/messages/${latest.id}`);
          if (msgRes.ok) {
            const msgData: MessagesResponse = await msgRes.json();
            if (!cancelled) setMessages(msgData.messages);
          }
        } else {
          // Create a new default session
          const createRes = await fetch("/api/chat/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, title: "New Chat" }),
          });
          if (createRes.ok) {
            const createData: CreateSessionResponse = await createRes.json();
            if (!cancelled) {
              setSessionId(createData.session.id);
              sessionIdRef.current = createData.session.id;
            }
          }
        }
      } catch (err) {
        console.error("[useChat] init error:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [userId]);

  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim()) return;

      // Ensure session exists before sending
      let sid = sessionIdRef.current;
      if (!sid) {
        try {
          const res = await fetch("/api/chat/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, title: text.slice(0, 50) }),
          });
          if (!res.ok) throw new Error("Failed to create session");
          const data: CreateSessionResponse = await res.json();
          sid = data.session.id;
          setSessionId(sid);
          sessionIdRef.current = sid;
        } catch {
          toast({ title: "Could not create chat session", variant: "destructive" });
          return;
        }
      }

      setIsSending(true);
      const optimisticId = `opt-${Date.now()}`;
      const optimisticMsg: Message = {
        id: optimisticId,
        sessionId: sid,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticMsg]);

      try {
        // 1. Persist user message
        const userRes = await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, role: "user", content: text }),
        });
        if (!userRes.ok) throw new Error("Failed to save user message");
        const { message: savedUser }: CreateMessageResponse = await userRes.json();
        setMessages((prev) => prev.map((m) => (m.id === optimisticId ? savedUser : m)));

        // 2. Get AI response
        const aiRes = await fetch(AI_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, message: text }),
        });
        if (!aiRes.ok) throw new Error("AI response failed");
        const aiData: AiChatResponse = await aiRes.json();

        // 3. Persist assistant message
        const assistRes = await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sid,
            role: "assistant",
            content: aiData.content,
            metadata: aiData.metadata,
          }),
        });
        if (!assistRes.ok) throw new Error("Failed to save assistant message");
        const { message: assistantMsg }: CreateMessageResponse = await assistRes.json();
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        toast({
          title: "Failed to send message",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setIsSending(false);
      }
    },
    [userId]
  );

  return { messages, isLoading, isSending, sendMessage, sessionId, userId };
}
