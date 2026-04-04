import { describe, expect, it } from "vitest";
import { en } from "./en";
import { ko } from "./ko";

/** Recursively collect all leaf keys from a nested object */
function getLeafKeys(obj: Record<string, any>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
      keys.push(...getLeafKeys(obj[key], path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

/** Get a nested value by dot path */
function getByPath(obj: Record<string, any>, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

describe("i18n key parity", () => {
  const enKeys = getLeafKeys(en);
  const koKeys = getLeafKeys(ko);

  it("all English keys exist in Korean", () => {
    const missingInKo = enKeys.filter(key => !koKeys.includes(key));
    if (missingInKo.length > 0) {
      console.log("Missing in ko:", missingInKo);
    }
    expect(missingInKo).toEqual([]);
  });

  it("all Korean keys exist in English", () => {
    const missingInEn = koKeys.filter(key => !enKeys.includes(key));
    if (missingInEn.length > 0) {
      console.log("Extra in ko:", missingInEn);
    }
    expect(missingInEn).toEqual([]);
  });

  it("no empty string values in Korean", () => {
    const emptyKeys = koKeys.filter(key => {
      const val = getByPath(ko, key);
      return typeof val === "string" && val.trim() === "";
    });
    if (emptyKeys.length > 0) {
      console.log("Empty Korean values:", emptyKeys);
    }
    expect(emptyKeys).toEqual([]);
  });

  it("no empty string values in English", () => {
    const emptyKeys = enKeys.filter(key => {
      const val = getByPath(en, key);
      return typeof val === "string" && val.trim() === "";
    });
    expect(emptyKeys).toEqual([]);
  });

  it("placeholder consistency: {n} in en implies {n} in ko", () => {
    const mismatched: string[] = [];
    for (const key of enKeys) {
      const enVal = getByPath(en, key);
      const koVal = getByPath(ko, key);
      if (typeof enVal !== "string" || typeof koVal !== "string") continue;
      // Find all {placeholder} patterns
      const enPlaceholders = enVal.match(/\{[^}]+\}/g) ?? [];
      for (const ph of enPlaceholders) {
        if (!koVal.includes(ph)) {
          mismatched.push(`${key}: en has ${ph} but ko doesn't`);
        }
      }
    }
    if (mismatched.length > 0) {
      console.log("Placeholder mismatches:", mismatched);
    }
    expect(mismatched).toEqual([]);
  });
});
