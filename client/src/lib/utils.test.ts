import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn (class name merger)", () => {
  it("merges multiple class strings", () => {
    const result = cn("text-sm", "font-bold");
    expect(result).toContain("text-sm");
    expect(result).toContain("font-bold");
  });

  it("handles conditional classes", () => {
    const active = true;
    const result = cn("base", active && "active-class");
    expect(result).toContain("active-class");
  });

  it("filters out falsy values", () => {
    const result = cn("base", false, null, undefined, "end");
    expect(result).toBe("base end");
  });

  it("tailwind-merges conflicting classes (last wins)", () => {
    const result = cn("px-2", "px-4");
    expect(result).toBe("px-4");
  });

  it("returns empty string for no args", () => {
    expect(cn()).toBe("");
  });
});
