/**
 * AnalyticsPage.tsx
 * Onchain analytics interface powered by Dune MCP.
 * Users type natural language queries and receive charts + insights.
 *
 * Features:
 *   - Chat-style query input (Enter to submit, Shift+Enter for newline)
 *   - 7 suggested queries for quick start
 *   - Chart rendering via recharts (line, bar, pie, counter, table)
 *   - Collapsible agent thought process accordion
 *   - "New Query" reset button
 */

import { useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface VisualizationData {
  type: "line" | "bar" | "pie" | "counter" | "table";
  title: string;
  data: Record<string, unknown>[];
  xKey?: string;
  yKey?: string;
}

interface AnalyticsResponse {
  thoughts: string[];
  result: string;
  visualization?: VisualizationData;
}

// ── Suggested queries ─────────────────────────────────────────────────────────

const SUGGESTED_QUERIES = [
  "Show me daily swap volume on Base Sepolia for the last 30 days",
  "How many unique wallets have interacted with PoolManager 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408?",
  "Find tables with USDC and EURC liquidity data on Base",
  "What blockchains does Dune index?",
  "Show current Dune API credit usage",
  "Create a query for daily transaction count on Base Sepolia",
  "Find decoded event tables for contract 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",
];

const CHART_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe"];

// ── Chart renderer ────────────────────────────────────────────────────────────

function ChartRenderer({ viz }: { viz: VisualizationData }) {
  if (!viz.data || viz.data.length === 0) return null;

  if (viz.type === "counter") {
    const value = viz.data[0]?.[viz.yKey ?? "value"];
    return (
      <div style={{ textAlign: "center", padding: "32px 0" }}>
        <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8 }}>{viz.title}</div>
        <div style={{ fontSize: 48, fontWeight: 700, color: "#6366f1" }}>{String(value ?? "—")}</div>
      </div>
    );
  }

  if (viz.type === "table") {
    const columns = Object.keys(viz.data[0] ?? {});
    return (
      <div style={{ overflowX: "auto", maxHeight: 400, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  style={{
                    padding: "8px 12px",
                    textAlign: "left",
                    borderBottom: "1px solid #2a2a3a",
                    color: "#9ca3af",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {viz.data.slice(0, 50).map((row, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #1a1a2e" }}>
                {columns.map((col) => (
                  <td
                    key={col}
                    style={{ padding: "7px 12px", color: "#e5e7eb", whiteSpace: "nowrap" }}
                  >
                    {String(row[col] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (viz.type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={viz.data}
            dataKey={viz.yKey ?? "value"}
            nameKey={viz.xKey ?? "name"}
            cx="50%"
            cy="50%"
            outerRadius={100}
            label
          >
            {viz.data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #2a2a3a", borderRadius: 8 }} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (viz.type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={viz.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
          <XAxis dataKey={viz.xKey ?? "date"} tick={{ fill: "#9ca3af", fontSize: 11 }} />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
          <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #2a2a3a", borderRadius: 8 }} />
          <Legend />
          <Bar dataKey={viz.yKey ?? "value"} fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Default: line chart
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={viz.data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
        <XAxis dataKey={viz.xKey ?? "date"} tick={{ fill: "#9ca3af", fontSize: 11 }} />
        <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
        <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #2a2a3a", borderRadius: 8 }} />
        <Legend />
        <Line
          type="monotone"
          dataKey={viz.yKey ?? "value"}
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showThoughts, setShowThoughts] = useState(false);

  async function handleSubmit(message: string) {
    const trimmed = message.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setShowThoughts(false);

    try {
      const res = await fetch("/api/agent/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data: AnalyticsResponse = await res.json();
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analytics request failed");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResponse(null);
    setQuery("");
    setError(null);
    setShowThoughts(false);
  }

  return (
    <div
      style={{
        maxWidth: 860,
        margin: "0 auto",
        padding: "40px 24px 80px",
        fontFamily: "inherit",
        color: "#e5e7eb",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
          Onchain Analytics
        </h1>
        <p style={{ fontSize: 14, color: "#9ca3af", margin: 0 }}>
          Powered by Dune Analytics · Query any onchain data in plain English
        </p>
      </div>

      {/* Suggested queries — shown only on empty state */}
      {!response && !loading && (
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 12, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Try asking:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SUGGESTED_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => { setQuery(q); handleSubmit(q); }}
                style={{
                  padding: "7px 14px",
                  borderRadius: 20,
                  border: "1px solid #2a2a3a",
                  background: "transparent",
                  color: "#c4b5fd",
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "border-color 0.15s, background 0.15s",
                  textAlign: "left",
                  lineHeight: 1.4,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#6366f1";
                  (e.currentTarget as HTMLButtonElement).style.background = "#6366f110";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2a3a";
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Query input */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 24 }}>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(query);
            }
          }}
          placeholder="Ask anything about onchain data... e.g. 'Show daily swap volume on Base for the last 30 days'"
          rows={2}
          disabled={loading}
          style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #2a2a3a",
            background: "#111827",
            color: "#e5e7eb",
            fontSize: 14,
            resize: "none",
            fontFamily: "inherit",
            lineHeight: 1.5,
            outline: "none",
            opacity: loading ? 0.6 : 1,
          }}
        />
        <button
          onClick={() => handleSubmit(query)}
          disabled={loading || !query.trim()}
          style={{
            padding: "12px 22px",
            borderRadius: 12,
            border: "none",
            background: loading || !query.trim() ? "#374151" : "#6366f1",
            color: loading || !query.trim() ? "#6b7280" : "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: loading || !query.trim() ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            transition: "background 0.15s",
          }}
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 0", color: "#9ca3af", fontSize: 14 }}>
          <span
            style={{
              display: "inline-block",
              width: 18,
              height: 18,
              border: "2px solid #6366f1",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
              flexShrink: 0,
            }}
          />
          Querying Dune Analytics — this may take 15–30 seconds…
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: 10,
            border: "1px solid #7f1d1d",
            background: "#1c0a0a",
            color: "#fca5a5",
            fontSize: 14,
            marginBottom: 20,
          }}
        >
          ⚠ {error}
        </div>
      )}

      {/* Results */}
      {response && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Visualization */}
          {response.visualization && (
            <div
              style={{
                padding: "20px 24px",
                borderRadius: 14,
                border: "1px solid #1f2937",
                background: "#111827",
              }}
            >
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px", color: "#e5e7eb" }}>
                {response.visualization.title}
              </h3>
              <ChartRenderer viz={response.visualization} />
            </div>
          )}

          {/* Text result */}
          {response.result && (
            <div
              style={{
                padding: "18px 22px",
                borderRadius: 14,
                border: "1px solid #1f2937",
                background: "#111827",
                fontSize: 14,
                lineHeight: 1.7,
                color: "#d1d5db",
                whiteSpace: "pre-wrap",
              }}
            >
              {response.result}
            </div>
          )}

          {/* Agent thought process accordion */}
          {response.thoughts.length > 0 && (
            <div
              style={{
                borderRadius: 12,
                border: "1px solid #1f2937",
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => setShowThoughts(!showThoughts)}
                style={{
                  width: "100%",
                  padding: "13px 18px",
                  background: "#0f172a",
                  border: "none",
                  color: "#6b7280",
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 10, transform: showThoughts ? "rotate(90deg)" : "none", transition: "transform 0.15s", display: "inline-block" }}>▶</span>
                Agent reasoning ({response.thoughts.length} step{response.thoughts.length !== 1 ? "s" : ""})
              </button>
              {showThoughts && (
                <div style={{ padding: "12px 18px 16px", background: "#0a0f1a" }}>
                  {response.thoughts.map((thought, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: 12,
                        padding: "8px 0",
                        borderBottom: i < response.thoughts.length - 1 ? "1px solid #1a2030" : "none",
                        fontSize: 13,
                        color: "#9ca3af",
                        lineHeight: 1.6,
                      }}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "#1e1b4b",
                          color: "#818cf8",
                          fontSize: 11,
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginTop: 1,
                        }}
                      >
                        {i + 1}
                      </span>
                      <span>{thought}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* New Query button */}
          <button
            onClick={handleReset}
            style={{
              alignSelf: "flex-start",
              padding: "10px 20px",
              borderRadius: 10,
              border: "1px solid #374151",
              background: "transparent",
              color: "#9ca3af",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ← New Query
          </button>
        </div>
      )}
    </div>
  );
}
