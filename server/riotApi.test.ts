import { describe, expect, it } from "vitest";
import {
  tierToTotalLP,
  totalLPToPrice,
  tierToPrice,
  priceToTierLabel,
  getAccountByRiotId,
} from "./riotApi";

describe("LP-to-Price mapping", () => {
  it("Platinum 4 0LP = $10", () => {
    expect(tierToPrice("PLATINUM", "IV", 0)).toBeCloseTo(10, 1);
  });

  it("Diamond 1 100LP = $100", () => {
    expect(tierToPrice("DIAMOND", "I", 100)).toBeCloseTo(100, 1);
  });

  it("Emerald 2 39LP = correct mid-range price", () => {
    // E2 = tier 5 (Emerald), div II = index 2
    // totalLP = (5-4)*4*100 + 2*100 + 39 = 400 + 200 + 39 = 639
    // price = 10 + (639/1200)*90 = 10 + 47.925 = 57.925
    const price = tierToPrice("EMERALD", "II", 39);
    expect(price).toBeCloseTo(57.93, 0);
  });

  it("totalLPToPrice is linear", () => {
    expect(totalLPToPrice(0)).toBe(10);
    expect(totalLPToPrice(600)).toBe(55);
    expect(totalLPToPrice(1200)).toBe(100);
  });

  it("tierToTotalLP calculates correctly", () => {
    expect(tierToTotalLP("PLATINUM", "IV", 0)).toBe(0);
    expect(tierToTotalLP("PLATINUM", "III", 50)).toBe(150);
    expect(tierToTotalLP("EMERALD", "IV", 0)).toBe(400);
    expect(tierToTotalLP("DIAMOND", "I", 100)).toBe(1200);
  });

  it("priceToTierLabel returns readable label", () => {
    const label = priceToTierLabel(55);
    expect(label).toContain("LP");
  });
});

describe("Riot API key validation", () => {
  it("can fetch account by riot id (validates API key)", async () => {
    // This test validates the RIOT_API_KEY env var is working
    // by making a real API call to get the player's PUUID
    try {
      const account = await getAccountByRiotId("목도리 도마뱀", "dori");
      expect(account).toBeDefined();
      expect(account.puuid).toBeDefined();
      expect(account.puuid.length).toBe(78);
      expect(account.gameName).toBeDefined();
      expect(account.tagLine).toBe("dori");
    } catch (err: any) {
      // If 401/403, the API key is invalid
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        throw new Error(
          `Riot API key is invalid or expired (HTTP ${err.response.status}). Please provide a valid key.`
        );
      }
      throw err;
    }
  }, 15000);
});
