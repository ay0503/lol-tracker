import { vi } from "vitest";
import type { TrpcContext } from "../_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

export function createAuthContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test Trader",
    loginMethod: "email",
    role: "user",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastSignedIn: new Date().toISOString(),
    ...overrides,
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

export function createAdminContext(): TrpcContext {
  return createAuthContext({ role: "admin" });
}

export function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}
