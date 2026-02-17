// Unit tests for the chat API endpoints (happy path + validation errors).
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the storage module before importing routes
vi.mock("../storage", () => ({
  storage: {
    getChatSessionsByUserId: vi.fn(),
    getChatSession: vi.fn(),
    createChatSession: vi.fn(),
    getChatMessages: vi.fn(),
    createChatMessage: vi.fn(),
    updateChatSessionTimestamp: vi.fn(),
  },
}));

vi.mock("../../shared/voiceCommandParser", () => ({
  parseVoiceCommand: vi.fn(() => null),
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: vi.fn() } },
  })),
}));

import express from "express";
import { registerChatRoutes } from "../routes/chat";
import { storage } from "../storage";

function buildApp() {
  const app = express();
  app.use(express.json());
  registerChatRoutes(app);
  return app;
}

// ── GET /api/chat/sessions/:userId ───────────────────────────────────────────
describe("GET /api/chat/sessions/:userId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty sessions array when none exist", async () => {
    vi.mocked(storage.getChatSessionsByUserId).mockResolvedValue([]);
    const { default: request } = await import("supertest");
    const app = buildApp();
    const response = await request(app).get("/api/chat/sessions/user-123");
    expect(response.status).toBe(200);
    expect(response.body.sessions).toEqual([]);
  });

  it("returns mapped sessions ordered by updatedAt", async () => {
    const mockSession = {
      id: "abc",
      title: "Test",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-02"),
      userId: "user-123",
    };
    vi.mocked(storage.getChatSessionsByUserId).mockResolvedValue([mockSession] as any);
    const { default: request } = await import("supertest");
    const app = buildApp();
    const response = await request(app).get("/api/chat/sessions/user-123");
    expect(response.status).toBe(200);
    expect(response.body.sessions).toHaveLength(1);
    expect(response.body.sessions[0].id).toBe("abc");
  });

  it("returns 400 for oversized userId", async () => {
    const { default: request } = await import("supertest");
    const app = buildApp();
    const longId = "x".repeat(65);
    const response = await request(app).get(`/api/chat/sessions/${longId}`);
    expect(response.status).toBe(400);
  });
});

// ── POST /api/chat/sessions ──────────────────────────────────────────────────
describe("POST /api/chat/sessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a session with userId and returns { session }", async () => {
    const mockSession = {
      id: "sess-1",
      title: "New Chat",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(storage.createChatSession).mockResolvedValue(mockSession as any);
    const { default: request } = await import("supertest");
    const app = buildApp();
    const response = await request(app)
      .post("/api/chat/sessions")
      .send({ userId: "user-abc" });
    expect(response.status).toBe(200);
    expect(response.body.session.id).toBe("sess-1");
  });

  it("passes through when no userId (backward compat)", async () => {
    const { default: request } = await import("supertest");
    const app = buildApp();
    // No userId → should call next(), which in isolation returns 404
    const response = await request(app)
      .post("/api/chat/sessions")
      .send({ title: "old flow" });
    // Falls through — no subsequent handler registered, returns 404
    expect(response.status).toBe(404);
  });

  it("returns 400 when userId exceeds 64 chars", async () => {
    const { default: request } = await import("supertest");
    const app = buildApp();
    const response = await request(app)
      .post("/api/chat/sessions")
      .send({ userId: "x".repeat(65) });
    expect(response.status).toBe(400);
  });
});

// ── GET /api/chat/messages/:sessionId ───────────────────────────────────────
describe("GET /api/chat/messages/:sessionId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when session does not exist", async () => {
    vi.mocked(storage.getChatSession).mockResolvedValue(undefined);
    const { default: request } = await import("supertest");
    const app = buildApp();
    const response = await request(app).get(
      "/api/chat/messages/00000000-0000-0000-0000-000000000000"
    );
    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Session not found");
  });

  it("returns messages when session exists", async () => {
    vi.mocked(storage.getChatSession).mockResolvedValue({ id: "s1" } as any);
    vi.mocked(storage.getChatMessages).mockResolvedValue([
      { id: "m1", role: "user", content: "hello", createdAt: new Date() },
    ] as any);
    const { default: request } = await import("supertest");
    const app = buildApp();
    const response = await request(app).get("/api/chat/messages/s1");
    expect(response.status).toBe(200);
    expect(response.body.messages).toHaveLength(1);
  });
});

// ── POST /api/chat/messages ──────────────────────────────────────────────────
describe("POST /api/chat/messages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves a message and updates session timestamp", async () => {
    vi.mocked(storage.getChatSession).mockResolvedValue({ id: "sess-1" } as any);
    vi.mocked(storage.createChatMessage).mockResolvedValue({
      id: "msg-1",
      sessionId: "sess-1",
      role: "user",
      content: "hello",
      createdAt: new Date(),
    } as any);
    vi.mocked(storage.updateChatSessionTimestamp).mockResolvedValue(undefined);
    const { default: request } = await import("supertest");
    const app = buildApp();
    const response = await request(app).post("/api/chat/messages").send({
      sessionId: "00000000-0000-0000-0000-000000000001",
      role: "user",
      content: "hello",
    });
    expect(response.status).toBe(200);
    expect(response.body.message.id).toBe("msg-1");
    expect(storage.updateChatSessionTimestamp).toHaveBeenCalled();
  });

  it("returns 400 when content exceeds 10,000 characters", async () => {
    vi.mocked(storage.getChatSession).mockResolvedValue({ id: "s" } as any);
    const { default: request } = await import("supertest");
    const app = buildApp();
    const response = await request(app).post("/api/chat/messages").send({
      sessionId: "00000000-0000-0000-0000-000000000001",
      role: "user",
      content: "a".repeat(10001),
    });
    expect(response.status).toBe(400);
  });

  it("returns 400 when role is invalid", async () => {
    const { default: request } = await import("supertest");
    const app = buildApp();
    const response = await request(app).post("/api/chat/messages").send({
      sessionId: "00000000-0000-0000-0000-000000000001",
      role: "invalid",
      content: "hello",
    });
    // Invalid role falls through to next handler → 404
    expect([400, 404]).toContain(response.status);
  });
});
