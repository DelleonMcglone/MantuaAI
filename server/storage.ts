import { 
  type ChatSession, 
  type InsertChatSession,
  type ChatMessage,
  type InsertChatMessage,
  type User,
  type InsertUser,
  type UserPreferences,
  type InsertUserPreferences,
  type Position,
  type InsertPosition,
  type AgentAction,
  type InsertAgentAction,
  type HookEvent,
  type InsertHookEvent,
  chatSessions,
  chatMessages,
  users,
  userPreferences,
  positions,
  agentActions,
  hookEvents
} from "../shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq, desc, and } from "drizzle-orm";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle({ client: pool });

export interface IStorage {
  // Users
  createUser(user: InsertUser): Promise<User>;
  getUser(walletAddress: string): Promise<User | undefined>;
  
  // User Preferences
  createUserPreferences(prefs: InsertUserPreferences): Promise<UserPreferences>;
  getUserPreferences(walletAddress: string): Promise<UserPreferences | undefined>;
  updateUserPreferences(walletAddress: string, prefs: Partial<InsertUserPreferences>): Promise<UserPreferences | undefined>;
  
  // Chat Sessions
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  getChatSession(id: string): Promise<ChatSession | undefined>;
  getChatSessionsByUserId(userId: string): Promise<ChatSession[]>;
  getRecentChatSessions(limit?: number, walletAddress?: string): Promise<ChatSession[]>;
  deleteChatSession(id: string): Promise<void>;
  updateChatSessionTimestamp(id: string): Promise<void>;
  
  // Chat Messages
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessages(sessionId: string): Promise<ChatMessage[]>;
  
  // Positions
  createPosition(position: InsertPosition): Promise<Position>;
  getPosition(id: string): Promise<Position | undefined>;
  getPositionsByWallet(walletAddress: string): Promise<Position[]>;
  updatePositionStatus(id: string, status: string): Promise<Position | undefined>;
  
  // Agent Actions
  createAgentAction(action: InsertAgentAction): Promise<AgentAction>;
  getAgentAction(id: string): Promise<AgentAction | undefined>;
  getAgentActionsByWallet(walletAddress: string, status?: string): Promise<AgentAction[]>;
  approveAgentAction(id: string): Promise<AgentAction | undefined>;
  updateAgentActionStatus(id: string, status: string, txHash?: string): Promise<AgentAction | undefined>;
  
  // Hook Events
  createHookEvent(event: InsertHookEvent): Promise<HookEvent>;
  getHookEventsByPool(poolAddress: string): Promise<HookEvent[]>;
  getHookEventsByType(hookType: string): Promise<HookEvent[]>;
}

export class DbStorage implements IStorage {
  // ============ USERS ============
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUser(walletAddress: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.walletAddress, walletAddress));
    return user;
  }

  // ============ USER PREFERENCES ============
  async createUserPreferences(prefs: InsertUserPreferences): Promise<UserPreferences> {
    const [pref] = await db.insert(userPreferences).values(prefs).returning();
    return pref;
  }

  async getUserPreferences(walletAddress: string): Promise<UserPreferences | undefined> {
    const [pref] = await db.select().from(userPreferences).where(eq(userPreferences.walletAddress, walletAddress));
    return pref;
  }

  async updateUserPreferences(walletAddress: string, prefs: Partial<InsertUserPreferences>): Promise<UserPreferences | undefined> {
    const [pref] = await db.update(userPreferences).set(prefs).where(eq(userPreferences.walletAddress, walletAddress)).returning();
    return pref;
  }

  // ============ CHAT SESSIONS ============
  async createChatSession(insertSession: InsertChatSession): Promise<ChatSession> {
    const [session] = await db.insert(chatSessions).values(insertSession).returning();
    return session;
  }

  async getChatSession(id: string): Promise<ChatSession | undefined> {
    const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, id));
    return session;
  }

  async getChatSessionsByUserId(userId: string): Promise<ChatSession[]> {
    return db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId))
      .orderBy(desc(chatSessions.updatedAt));
  }

  async getRecentChatSessions(limit: number = 20, walletAddress?: string): Promise<ChatSession[]> {
    if (walletAddress) {
      return db.select().from(chatSessions).where(eq(chatSessions.walletAddress, walletAddress)).orderBy(desc(chatSessions.updatedAt)).limit(limit);
    }
    return db.select().from(chatSessions).orderBy(desc(chatSessions.updatedAt)).limit(limit);
  }

  async deleteChatSession(id: string): Promise<void> {
    await db.delete(chatSessions).where(eq(chatSessions.id, id));
  }

  async updateChatSessionTimestamp(id: string): Promise<void> {
    await db.update(chatSessions).set({ updatedAt: new Date() }).where(eq(chatSessions.id, id));
  }

  // ============ CHAT MESSAGES ============
  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const [message] = await db.insert(chatMessages).values(insertMessage).returning();
    return message;
  }

  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    return db.select().from(chatMessages).where(eq(chatMessages.sessionId, sessionId)).orderBy(chatMessages.createdAt);
  }

  // ============ POSITIONS ============
  async createPosition(insertPosition: InsertPosition): Promise<Position> {
    const [position] = await db.insert(positions).values(insertPosition).returning();
    return position;
  }

  async getPosition(id: string): Promise<Position | undefined> {
    const [position] = await db.select().from(positions).where(eq(positions.id, id));
    return position;
  }

  async getPositionsByWallet(walletAddress: string): Promise<Position[]> {
    return db.select().from(positions).where(eq(positions.walletAddress, walletAddress));
  }

  async updatePositionStatus(id: string, status: string): Promise<Position | undefined> {
    const [position] = await db.update(positions).set({ status }).where(eq(positions.id, id)).returning();
    return position;
  }

  // ============ AGENT ACTIONS ============
  async createAgentAction(insertAction: InsertAgentAction): Promise<AgentAction> {
    const [action] = await db.insert(agentActions).values(insertAction).returning();
    return action;
  }

  async getAgentAction(id: string): Promise<AgentAction | undefined> {
    const [action] = await db.select().from(agentActions).where(eq(agentActions.id, id));
    return action;
  }

  async getAgentActionsByWallet(walletAddress: string, status?: string): Promise<AgentAction[]> {
    if (status) {
      return db.select().from(agentActions).where(and(eq(agentActions.walletAddress, walletAddress), eq(agentActions.status, status))).orderBy(desc(agentActions.createdAt));
    }
    return db.select().from(agentActions).where(eq(agentActions.walletAddress, walletAddress)).orderBy(desc(agentActions.createdAt));
  }

  async approveAgentAction(id: string): Promise<AgentAction | undefined> {
    const [action] = await db.update(agentActions).set({ approvedAt: new Date(), status: 'approved' }).where(eq(agentActions.id, id)).returning();
    return action;
  }

  async updateAgentActionStatus(id: string, status: string, txHash?: string): Promise<AgentAction | undefined> {
    const updateData: any = { status };
    if (txHash) updateData.txHash = txHash;
    const [action] = await db.update(agentActions).set(updateData).where(eq(agentActions.id, id)).returning();
    return action;
  }

  // ============ HOOK EVENTS ============
  async createHookEvent(insertEvent: InsertHookEvent): Promise<HookEvent> {
    const [event] = await db.insert(hookEvents).values(insertEvent).returning();
    return event;
  }

  async getHookEventsByPool(poolAddress: string): Promise<HookEvent[]> {
    return db.select().from(hookEvents).where(eq(hookEvents.poolAddress, poolAddress)).orderBy(desc(hookEvents.createdAt));
  }

  async getHookEventsByType(hookType: string): Promise<HookEvent[]> {
    return db.select().from(hookEvents).where(eq(hookEvents.hookType, hookType)).orderBy(desc(hookEvents.createdAt));
  }
}

export const storage = new DbStorage();
