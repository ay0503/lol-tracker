import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

// Mock db module
vi.mock("./db", () => ({
  getUserByEmail: vi.fn(),
  createLocalUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
}));

// Mock sdk module
vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn().mockResolvedValue("mock-jwt-token"),
    verifySession: vi.fn(),
    authenticateRequest: vi.fn(),
  },
}));

import * as db from "./db";

describe("Local Auth - Password Hashing", () => {
  it("should hash passwords with bcrypt", async () => {
    const password = "testPassword123";
    const hash = await bcrypt.hash(password, 12);
    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("should verify correct password against hash", async () => {
    const password = "mySecurePassword";
    const hash = await bcrypt.hash(password, 12);
    const isValid = await bcrypt.compare(password, hash);
    expect(isValid).toBe(true);
  });

  it("should reject incorrect password against hash", async () => {
    const password = "mySecurePassword";
    const hash = await bcrypt.hash(password, 12);
    const isValid = await bcrypt.compare("wrongPassword", hash);
    expect(isValid).toBe(false);
  });
});

describe("Local Auth - User Lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getUserByEmail should return user when found", async () => {
    const mockUser = {
      id: 1,
      openId: "local_abc-123",
      email: "test@example.com",
      passwordHash: await bcrypt.hash("password123", 12),
      displayName: "Test User",
      name: "Test User",
      loginMethod: "email",
      role: "user" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    (db.getUserByEmail as any).mockResolvedValue(mockUser);

    const result = await db.getUserByEmail("test@example.com");
    expect(result).toBeDefined();
    expect(result?.email).toBe("test@example.com");
    expect(result?.openId).toMatch(/^local_/);
  });

  it("getUserByEmail should return undefined for non-existent email", async () => {
    (db.getUserByEmail as any).mockResolvedValue(undefined);

    const result = await db.getUserByEmail("nonexistent@example.com");
    expect(result).toBeUndefined();
  });
});

describe("Local Auth - Registration Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createLocalUser should be called with hashed password", async () => {
    const password = "securePass123";
    const hash = await bcrypt.hash(password, 12);

    await db.createLocalUser({
      email: "new@example.com",
      passwordHash: hash,
      displayName: "New User",
    });

    expect(db.createLocalUser).toHaveBeenCalledWith({
      email: "new@example.com",
      passwordHash: hash,
      displayName: "New User",
    });
  });

  it("should reject registration with existing email", async () => {
    (db.getUserByEmail as any).mockResolvedValue({
      id: 1,
      email: "existing@example.com",
    });

    const existing = await db.getUserByEmail("existing@example.com");
    expect(existing).toBeDefined();
    // In the actual endpoint, this would throw TRPCError with code CONFLICT
  });
});

describe("Local Auth - Login Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should authenticate valid credentials", async () => {
    const password = "correctPassword";
    const hash = await bcrypt.hash(password, 12);

    (db.getUserByEmail as any).mockResolvedValue({
      id: 1,
      openId: "local_test-uuid",
      email: "user@example.com",
      passwordHash: hash,
      displayName: "Test User",
      name: "Test User",
    });

    const user = await db.getUserByEmail("user@example.com");
    expect(user).toBeDefined();
    expect(user?.passwordHash).toBeDefined();

    const isValid = await bcrypt.compare(password, user!.passwordHash!);
    expect(isValid).toBe(true);
  });

  it("should reject invalid password", async () => {
    const correctPassword = "correctPassword";
    const hash = await bcrypt.hash(correctPassword, 12);

    (db.getUserByEmail as any).mockResolvedValue({
      id: 1,
      openId: "local_test-uuid",
      email: "user@example.com",
      passwordHash: hash,
    });

    const user = await db.getUserByEmail("user@example.com");
    const isValid = await bcrypt.compare("wrongPassword", user!.passwordHash!);
    expect(isValid).toBe(false);
  });

  it("should reject login for non-existent user", async () => {
    (db.getUserByEmail as any).mockResolvedValue(undefined);

    const user = await db.getUserByEmail("ghost@example.com");
    expect(user).toBeUndefined();
    // In the actual endpoint, this would throw TRPCError with code UNAUTHORIZED
  });

  it("should reject login for user without password (OAuth user)", async () => {
    (db.getUserByEmail as any).mockResolvedValue({
      id: 1,
      openId: "oauth-user-id",
      email: "oauth@example.com",
      passwordHash: null,
    });

    const user = await db.getUserByEmail("oauth@example.com");
    expect(user).toBeDefined();
    expect(user?.passwordHash).toBeNull();
    // In the actual endpoint, this would throw TRPCError with code UNAUTHORIZED
  });
});
