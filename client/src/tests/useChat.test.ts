// Unit tests for the useChat hook: session init, sendMessage, error handling.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useChat } from "../hooks/useChat";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    clear: () => { store = {}; },
    removeItem: (key: string) => { delete store[key]; },
  };
})();
Object.defineProperty(global, "localStorage", { value: localStorageMock });

// Mock crypto.randomUUID
Object.defineProperty(global, "crypto", {
  value: { randomUUID: () => "test-uuid-1234" },
});

// Mock toast
vi.mock("../hooks/use-toast", () => ({
  toast: vi.fn(),
}));

const SESSION_RESPONSE = {
  sessions: [{ id: "sess-1", title: "My Chat", createdAt: "2024-01-01", updatedAt: "2024-01-02" }],
};
const EMPTY_SESSIONS = { sessions: [] };
const CREATE_SESSION = { session: { id: "new-sess", title: "New Chat", createdAt: "2024-01-01", updatedAt: "2024-01-01" } };
const MESSAGES_RESPONSE = { messages: [{ id: "m1", role: "user", content: "hello", createdAt: "2024-01-01", sessionId: "sess-1" }] };

function mockFetch(responses: Array<unknown>) {
  let callIndex = 0;
  global.fetch = vi.fn().mockImplementation(() => {
    const response = responses[callIndex++] ?? responses[responses.length - 1];
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(response),
    });
  });
}

describe("useChat — initialization", () => {
  beforeEach(() => localStorageMock.clear());
  afterEach(() => vi.restoreAllMocks());

  it("generates userId and stores in localStorage if not present", async () => {
    mockFetch([EMPTY_SESSIONS, CREATE_SESSION]);
    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(localStorageMock.getItem("mantua_user_id")).toBe("test-uuid-1234");
    expect(result.current.userId).toBe("test-uuid-1234");
  });

  it("reuses existing userId from localStorage", async () => {
    localStorageMock.setItem("mantua_user_id", "existing-user");
    mockFetch([EMPTY_SESSIONS, CREATE_SESSION]);
    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.userId).toBe("existing-user");
  });

  it("fetches existing session and loads messages", async () => {
    localStorageMock.setItem("mantua_user_id", "user-1");
    mockFetch([SESSION_RESPONSE, MESSAGES_RESPONSE]);
    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sessionId).toBe("sess-1");
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe("hello");
  });

  it("creates a new session when none exist", async () => {
    localStorageMock.setItem("mantua_user_id", "user-2");
    mockFetch([EMPTY_SESSIONS, CREATE_SESSION]);
    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sessionId).toBe("new-sess");
  });
});

describe("useChat — sendMessage", () => {
  beforeEach(() => localStorageMock.clear());
  afterEach(() => vi.restoreAllMocks());

  it("optimistically adds user message, then replaces with persisted version", async () => {
    localStorageMock.setItem("mantua_user_id", "user-3");
    const savedUserMsg = { id: "real-m1", sessionId: "sess-1", role: "user", content: "hi", createdAt: "2024-01-01" };
    const aiResponse = { content: "Hello!", metadata: null, sessionId: "sess-1" };
    const assistantMsg = { id: "real-m2", sessionId: "sess-1", role: "assistant", content: "Hello!", createdAt: "2024-01-01" };

    mockFetch([
      SESSION_RESPONSE,        // init: sessions
      MESSAGES_RESPONSE,       // init: messages
      { message: savedUserMsg }, // POST user message
      aiResponse,               // POST /api/ai/chat
      { message: assistantMsg }, // POST assistant message
    ]);

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    const msgs = result.current.messages;
    expect(msgs.some((m) => m.id === "real-m1")).toBe(true);
    expect(msgs.some((m) => m.role === "assistant")).toBe(true);
  });

  it("removes optimistic message on API error and shows toast", async () => {
    const { toast } = await import("../hooks/use-toast");
    localStorageMock.setItem("mantua_user_id", "user-4");
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(SESSION_RESPONSE) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(MESSAGES_RESPONSE) })
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: "fail" }) });

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const initialCount = result.current.messages.length;
    await act(async () => {
      await result.current.sendMessage("fail message");
    });

    expect(result.current.messages.length).toBe(initialCount);
    expect(toast).toHaveBeenCalled();
  });

  it("does nothing when text is empty", async () => {
    localStorageMock.setItem("mantua_user_id", "user-5");
    mockFetch([SESSION_RESPONSE, MESSAGES_RESPONSE]);
    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const fetchCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await act(async () => {
      await result.current.sendMessage("   ");
    });
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(fetchCalls);
  });
});
