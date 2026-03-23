/**
 * analyticsAgent.test.ts
 * Integration tests for POST /api/agent/analytics
 * Uses vitest + supertest — mocks the Dune agent to avoid live API calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import analyticsAgentRouter from "../routes/analyticsAgent";

// ── Mock the analytics agent service ────────────────────────────────────────

vi.mock("../services/duneAnalyticsAgent", () => ({
  runAnalyticsAgent: vi.fn().mockResolvedValue({
    thoughts: [
      "Searching Dune tables for Base Sepolia transaction data...",
      "Found base_sepolia.transactions — creating query.",
    ],
    result: "Base Sepolia had 1.2M transactions in the last 30 days.",
    visualization: {
      type: "line",
      title: "Daily Transactions — Base Sepolia",
      data: [
        { date: "2026-02-01", value: 42000 },
        { date: "2026-02-02", value: 45000 },
      ],
      xKey: "date",
      yKey: "value",
    },
  }),
}));

// ── Build a minimal Express app with the route under test ────────────────────

function buildApp(duneApiKey?: string) {
  const app = express();
  app.use(express.json());

  // Inject env var for this test app
  if (duneApiKey !== undefined) {
    process.env.DUNE_API_KEY = duneApiKey;
  }

  app.use("/api/agent/analytics", analyticsAgentRouter);
  return app;
}

describe("POST /api/agent/analytics", () => {
  const originalKey = process.env.DUNE_API_KEY;

  beforeEach(() => {
    process.env.DUNE_API_KEY = "test-key-for-unit-tests";
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.DUNE_API_KEY = originalKey;
    } else {
      delete process.env.DUNE_API_KEY;
    }
  });

  it("returns 200 with result, thoughts, and visualization for a valid message", async () => {
    const app = buildApp("test-key");
    const res = await request(app)
      .post("/api/agent/analytics")
      .send({ message: "Show daily transactions on Base Sepolia" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("result");
    expect(typeof res.body.result).toBe("string");
    expect(res.body).toHaveProperty("thoughts");
    expect(Array.isArray(res.body.thoughts)).toBe(true);
    expect(res.body.thoughts.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty("visualization");
    expect(res.body.visualization).toHaveProperty("type");
    expect(res.body.visualization).toHaveProperty("data");
    expect(Array.isArray(res.body.visualization.data)).toBe(true);
  });

  it("returns 400 for empty message string", async () => {
    const app = buildApp("test-key");
    const res = await request(app)
      .post("/api/agent/analytics")
      .send({ message: "" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 for missing message field", async () => {
    const app = buildApp("test-key");
    const res = await request(app)
      .post("/api/agent/analytics")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 for message exceeding 2000 characters", async () => {
    const app = buildApp("test-key");
    const res = await request(app)
      .post("/api/agent/analytics")
      .send({ message: "a".repeat(2001) });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 for whitespace-only message", async () => {
    const app = buildApp("test-key");
    const res = await request(app)
      .post("/api/agent/analytics")
      .send({ message: "   " });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 503 when DUNE_API_KEY is not set", async () => {
    delete process.env.DUNE_API_KEY;
    const app = buildApp(undefined);

    const res = await request(app)
      .post("/api/agent/analytics")
      .send({ message: "Show volume data" });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/DUNE_API_KEY/);
  });

  it("trims leading/trailing whitespace from message before processing", async () => {
    const app = buildApp("test-key");
    const res = await request(app)
      .post("/api/agent/analytics")
      .send({ message: "  Show volume data  " });

    // Zod .trim() means the message is valid — agent should be called
    expect(res.status).toBe(200);
  });
});
