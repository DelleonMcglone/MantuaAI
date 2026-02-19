import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer, numeric, bigint, boolean, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============ USERS ============
export const users = pgTable("users", {
  walletAddress: text("wallet_address").primaryKey(),
  chainId: integer("chain_id").default(84532),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ============ USER PREFERENCES ============
export const userPreferences = pgTable("user_preferences", {
  walletAddress: text("wallet_address").primaryKey().references(() => users.walletAddress, { onDelete: 'cascade' }),
  theme: text("theme").default('dark'),
  slippage: numeric("slippage").default('0.5'),
  autoApproveThreshold: numeric("auto_approve_threshold").default('0'),
  notifications: jsonb("notifications").default({}),
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences);

export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;

// ============ CHAT SESSIONS ============
export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").references(() => users.walletAddress, { onDelete: 'cascade' }),
  userId: varchar("user_id", { length: 64 }),
  title: text("title").default('New Chat'),
  context: jsonb("context").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;

// ============ CHAT MESSAGES ============
export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id").notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  inputType: text("input_type").default('text'),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// ============ POSITIONS ============
export const positions = pgTable("positions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull().references(() => users.walletAddress, { onDelete: 'cascade' }),
  poolAddress: text("pool_address").notNull(),
  token0: text("token0").notNull(),
  token1: text("token1").notNull(),
  tickLower: integer("tick_lower").notNull(),
  tickUpper: integer("tick_upper").notNull(),
  liquidity: numeric("liquidity").notNull(),
  status: text("status").default('active'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  createdAt: true,
});

export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Position = typeof positions.$inferSelect;

// ============ AGENT ACTIONS ============
export const agentActions = pgTable("agent_actions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull().references(() => users.walletAddress, { onDelete: 'cascade' }),
  actionType: text("action_type").notNull(),
  params: jsonb("params").notNull(),
  requiresApproval: boolean("requires_approval").default(true),
  approvedAt: timestamp("approved_at"),
  txHash: text("tx_hash"),
  status: text("status").default('pending'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAgentActionSchema = createInsertSchema(agentActions).omit({
  id: true,
  createdAt: true,
});

export type InsertAgentAction = z.infer<typeof insertAgentActionSchema>;
export type AgentAction = typeof agentActions.$inferSelect;

// ============ HOOK EVENTS ============
export const hookEvents = pgTable("hook_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  hookType: text("hook_type").notNull(),
  poolAddress: text("pool_address").notNull(),
  eventData: jsonb("event_data").notNull(),
  blockNumber: bigint("block_number", { mode: 'number' }).notNull(),
  txHash: text("tx_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertHookEventSchema = createInsertSchema(hookEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertHookEvent = z.infer<typeof insertHookEventSchema>;
export type HookEvent = typeof hookEvents.$inferSelect;

// ============ PREDICTION MARKETS ============
export const predictionMarkets = pgTable("prediction_markets", {
  id:           integer("id").primaryKey().generatedAlwaysAsIdentity(),
  chainId:      integer("chain_id").notNull(),
  contractId:   integer("contract_id").notNull(),
  question:     text("question").notNull(),
  category:     varchar("category", { length: 50 }).notNull(),
  endTime:      timestamp("end_time", { withTimezone: true }).notNull(),
  resolved:     boolean("resolved").default(false),
  outcome:      boolean("outcome"),
  totalYesUsdc: numeric("total_yes_usdc", { precision: 20, scale: 6 }).default('0'),
  totalNoUsdc:  numeric("total_no_usdc",  { precision: 20, scale: 6 }).default('0'),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPredictionMarketSchema = createInsertSchema(predictionMarkets).omit({
  id: true,
  createdAt: true,
});

export type InsertPredictionMarket = z.infer<typeof insertPredictionMarketSchema>;
export type PredictionMarket = typeof predictionMarkets.$inferSelect;

// ============ PREDICTION POSITIONS ============
export const predictionPositions = pgTable("prediction_positions", {
  id:           integer("id").primaryKey().generatedAlwaysAsIdentity(),
  chainId:      integer("chain_id").notNull(),
  marketId:     integer("market_id").notNull().references(() => predictionMarkets.id),
  userAddress:  varchar("user_address", { length: 42 }).notNull(),
  yesShares:    numeric("yes_shares", { precision: 20, scale: 6 }).default('0'),
  noShares:     numeric("no_shares",  { precision: 20, scale: 6 }).default('0'),
  avgYesPrice:  numeric("avg_yes_price", { precision: 10, scale: 6 }),
  avgNoPrice:   numeric("avg_no_price",  { precision: 10, scale: 6 }),
  claimed:      boolean("claimed").default(false),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPredictionPositionSchema = createInsertSchema(predictionPositions).omit({
  id: true,
});

export type InsertPredictionPosition = z.infer<typeof insertPredictionPositionSchema>;
export type PredictionPosition = typeof predictionPositions.$inferSelect;

// ============ POLYMARKET CACHE ============
export const polymarketMarketsCache = pgTable("polymarket_markets_cache", {
  id:        varchar("id", { length: 100 }).primaryKey(),
  question:  text("question").notNull(),
  category:  varchar("category", { length: 50 }),
  yesPrice:  numeric("yes_price", { precision: 10, scale: 6 }),
  noPrice:   numeric("no_price",  { precision: 10, scale: 6 }),
  volume24h: numeric("volume_24h", { precision: 20, scale: 2 }),
  endDate:   timestamp("end_date", { withTimezone: true }),
  active:    boolean("active").default(true),
  cachedAt:  timestamp("cached_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPolymarketCacheSchema = createInsertSchema(polymarketMarketsCache).omit({
  cachedAt: true,
});

export type InsertPolymarketCache = z.infer<typeof insertPolymarketCacheSchema>;
export type PolymarketCache = typeof polymarketMarketsCache.$inferSelect;

// ============ ARBITRAGE OPPORTUNITIES ============
export const arbitrageOpportunities = pgTable("arbitrage_opportunities", {
  id:          integer("id").primaryKey().generatedAlwaysAsIdentity(),
  question:    text("question").notNull(),
  venueA:      varchar("venue_a", { length: 20 }).notNull(),
  venueB:      varchar("venue_b", { length: 20 }).notNull(),
  yesPriceA:   numeric("yes_price_a", { precision: 10, scale: 6 }),
  yesPriceB:   numeric("yes_price_b", { precision: 10, scale: 6 }),
  spreadPct:   numeric("spread_pct",  { precision: 10, scale: 4 }),
  detectedAt:  timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertArbitrageOpportunitySchema = createInsertSchema(arbitrageOpportunities).omit({
  id: true,
  detectedAt: true,
});

export type InsertArbitrageOpportunity = z.infer<typeof insertArbitrageOpportunitySchema>;
export type ArbitrageOpportunity = typeof arbitrageOpportunities.$inferSelect;
