import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cache } from "./cache";

describe("MemoryCache", () => {
  beforeEach(() => {
    cache.invalidateAll();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── get / set ───

  it("set + get: stores and retrieves a value", () => {
    cache.set("key1", "hello", 60_000);
    expect(cache.get("key1")).toBe("hello");
  });

  it("get returns undefined for unknown key", () => {
    expect(cache.get("nonexistent")).toBeUndefined();
  });

  it("get returns undefined after TTL expires", () => {
    cache.set("key1", "value", 5_000);
    expect(cache.get("key1")).toBe("value");
    vi.advanceTimersByTime(6_000);
    expect(cache.get("key1")).toBeUndefined();
  });

  it("get cleans up expired entry from store", () => {
    cache.set("key1", "value", 1_000);
    vi.advanceTimersByTime(2_000);
    cache.get("key1"); // triggers cleanup
    expect(cache.stats().size).toBe(0);
  });

  // ─── getOrSet ───

  it("getOrSet calls factory on cache miss", async () => {
    const factory = vi.fn(() => 42);
    const result = await cache.getOrSet("num", factory, 60_000);
    expect(result).toBe(42);
    expect(factory).toHaveBeenCalledOnce();
  });

  it("getOrSet does NOT call factory on cache hit", async () => {
    cache.set("num", 42, 60_000);
    const factory = vi.fn(() => 99);
    const result = await cache.getOrSet("num", factory, 60_000);
    expect(result).toBe(42);
    expect(factory).not.toHaveBeenCalled();
  });

  it("getOrSet calls factory again after TTL expires", async () => {
    const factory = vi.fn(() => "fresh");
    await cache.getOrSet("val", () => "stale", 5_000);
    vi.advanceTimersByTime(6_000);
    const result = await cache.getOrSet("val", factory, 5_000);
    expect(result).toBe("fresh");
    expect(factory).toHaveBeenCalledOnce();
  });

  it("getOrSet works with async factory", async () => {
    const factory = vi.fn(async () => "async-value");
    const result = await cache.getOrSet("async", factory, 60_000);
    expect(result).toBe("async-value");
  });

  // ─── invalidation ───

  it("invalidate removes specific key", () => {
    cache.set("a", 1, 60_000);
    cache.set("b", 2, 60_000);
    cache.invalidate("a");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
  });

  it("invalidatePrefix removes matching keys and keeps others", () => {
    cache.set("prices.latest", 50, 60_000);
    cache.set("prices.history", [1, 2], 60_000);
    cache.set("user.profile", { name: "test" }, 60_000);
    cache.invalidatePrefix("prices.");
    expect(cache.get("prices.latest")).toBeUndefined();
    expect(cache.get("prices.history")).toBeUndefined();
    expect(cache.get("user.profile")).toEqual({ name: "test" });
  });

  it("invalidateAll clears entire store", () => {
    cache.set("a", 1, 60_000);
    cache.set("b", 2, 60_000);
    cache.set("c", 3, 60_000);
    cache.invalidateAll();
    expect(cache.stats().size).toBe(0);
  });

  // ─── stats ───

  it("stats returns correct size and keys, excluding expired", () => {
    cache.set("alive", "yes", 60_000);
    cache.set("dying", "soon", 1_000);
    vi.advanceTimersByTime(2_000);
    const info = cache.stats();
    expect(info.size).toBe(1);
    expect(info.keys).toEqual(["alive"]);
  });
});
