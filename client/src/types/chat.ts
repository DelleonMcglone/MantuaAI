// Shared frontend types for the chat interface and persistence layer.
import type { SwapCommand, LiquidityCommand } from "@shared/voiceCommandTypes";

export type { SwapCommand, LiquidityCommand };

/** Metadata attached to an assistant message when a DeFi command was parsed. */
export interface CommandMetadata {
  command: SwapCommand | LiquidityCommand;
}

/** A persisted chat message returned from the API. */
export interface ChartMetadata {
  chartType: 'line' | 'bar' | 'pie' | 'table' | 'stat';
  title: string;
  description: string;
  data: any[];
  isLoading?: boolean;
  error?: string | null;
}

/** Dune Analytics query result attached to an assistant message */
export interface DuneMetadata {
  rows: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  label: string;
  duneUrl?: string;
  isLoading?: boolean;
  error?: string | null;
}

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  /** Present on assistant messages when a DeFi command was detected. */
  metadata?: CommandMetadata | null;
  /** Present on assistant messages containing analytics chart data */
  chart?: ChartMetadata | null;
  /** Present on assistant messages containing Dune Analytics table data */
  dune?: DuneMetadata | null;
  createdAt: string; // ISO-8601
}

/** A chat session returned from the API. */
export interface ChatSession {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Shape of POST /api/chat/sessions response. */
export interface CreateSessionResponse {
  session: ChatSession;
}

/** Shape of GET /api/chat/sessions/:userId response. */
export interface SessionsResponse {
  sessions: ChatSession[];
}

/** Shape of GET /api/chat/messages/:sessionId response. */
export interface MessagesResponse {
  messages: Message[];
}

/** Shape of POST /api/chat/messages response. */
export interface CreateMessageResponse {
  message: Message;
}

/** Shape of POST /api/ai/chat response. */
export interface AiChatResponse {
  content: string;
  metadata?: CommandMetadata;
  sessionId: string;
}
