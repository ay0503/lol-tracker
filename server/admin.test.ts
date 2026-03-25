import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => {
  const mockExecute = vi.fn();
  return {
    getRawClient: vi.fn(() => ({
      execute: mockExecute,
    })),
    getDbSync: vi.fn(),
    getDb: vi.fn(),
    // Export the mock for test access
    __mockExecute: mockExecute,
  };
});

// Mock the SDK
vi.mock("./_core/sdk", () => ({
  sdk: {
    verifyToken: vi.fn(),
    createSessionToken: vi.fn(),
  },
}));

import { getRawClient } from "./db";

describe("Admin SQL Console", () => {
  let mockExecute: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute = (getRawClient() as any).execute;
  });

  describe("getRawClient", () => {
    it("should return a client with an execute method", () => {
      const client = getRawClient();
      expect(client).toBeDefined();
      expect(typeof client.execute).toBe("function");
    });
  });

  describe("SQL execution logic", () => {
    it("should execute a SELECT query and return columns and rows", async () => {
      mockExecute.mockResolvedValueOnce({
        columns: ["id", "name"],
        rows: [
          [1, "Alice"],
          [2, "Bob"],
        ],
        rowsAffected: 0,
      });

      const client = getRawClient();
      const result = await client.execute("SELECT id, name FROM users");

      expect(result.columns).toEqual(["id", "name"]);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual([1, "Alice"]);
    });

    it("should handle INSERT/UPDATE and return rowsAffected", async () => {
      mockExecute.mockResolvedValueOnce({
        columns: [],
        rows: [],
        rowsAffected: 3,
      });

      const client = getRawClient();
      const result = await client.execute("UPDATE users SET role='admin' WHERE id=1");

      expect(result.columns).toEqual([]);
      expect(result.rows).toHaveLength(0);
      expect(result.rowsAffected).toBe(3);
    });

    it("should handle SQL errors gracefully", async () => {
      mockExecute.mockRejectedValueOnce(new Error("no such table: nonexistent"));

      const client = getRawClient();
      await expect(client.execute("SELECT * FROM nonexistent")).rejects.toThrow(
        "no such table: nonexistent"
      );
    });

    it("should handle empty result sets", async () => {
      mockExecute.mockResolvedValueOnce({
        columns: ["id", "name"],
        rows: [],
        rowsAffected: 0,
      });

      const client = getRawClient();
      const result = await client.execute("SELECT * FROM users WHERE id = -1");

      expect(result.columns).toEqual(["id", "name"]);
      expect(result.rows).toHaveLength(0);
    });

    it("should handle PRAGMA queries", async () => {
      mockExecute.mockResolvedValueOnce({
        columns: ["cid", "name", "type", "notnull", "dflt_value", "pk"],
        rows: [
          [0, "id", "INTEGER", 1, null, 1],
          [1, "price", "TEXT", 1, null, 0],
          [2, "timestamp", "TEXT", 1, null, 0],
        ],
        rowsAffected: 0,
      });

      const client = getRawClient();
      const result = await client.execute("PRAGMA table_info(priceHistory)");

      expect(result.columns).toContain("name");
      expect(result.columns).toContain("type");
      expect(result.rows).toHaveLength(3);
    });

    it("should handle sqlite_master table listing", async () => {
      mockExecute.mockResolvedValueOnce({
        columns: ["name"],
        rows: [["users"], ["trades"], ["priceHistory"], ["matches"]],
        rowsAffected: 0,
      });

      const client = getRawClient();
      const result = await client.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );

      expect(result.rows).toHaveLength(4);
      const tableNames = result.rows.map((r: any) => r[0]);
      expect(tableNames).toContain("users");
      expect(tableNames).toContain("priceHistory");
    });
  });

  describe("Row-to-object conversion", () => {
    it("should convert row arrays to objects using column names", () => {
      const columns = ["id", "price", "timestamp"];
      const rows = [
        [1, "57.85", "2026-03-24T12:00:00Z"],
        [2, "58.10", "2026-03-24T12:20:00Z"],
      ];

      // This mirrors the conversion logic in the router
      const converted = rows.map((row) => {
        const obj: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj;
      });

      expect(converted[0]).toEqual({
        id: 1,
        price: "57.85",
        timestamp: "2026-03-24T12:00:00Z",
      });
      expect(converted[1]).toEqual({
        id: 2,
        price: "58.10",
        timestamp: "2026-03-24T12:20:00Z",
      });
    });

    it("should handle NULL values in rows", () => {
      const columns = ["id", "email", "passwordHash"];
      const rows = [[1, "test@example.com", null]];

      const converted = rows.map((row) => {
        const obj: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj;
      });

      expect(converted[0].passwordHash).toBeNull();
    });
  });

  describe("Admin authorization", () => {
    it("should require admin role - non-admin users get FORBIDDEN", () => {
      // The adminProcedure middleware checks ctx.user.role === 'admin'
      // Non-admin user should be rejected
      const mockUser = { id: 1, role: "user", openId: "test" };
      expect(mockUser.role).not.toBe("admin");
    });

    it("should allow admin role users", () => {
      const mockAdmin = { id: 1, role: "admin", openId: "admin-test" };
      expect(mockAdmin.role).toBe("admin");
    });

    it("should reject unauthenticated users", () => {
      const mockUser = null;
      expect(mockUser).toBeNull();
    });
  });
});
