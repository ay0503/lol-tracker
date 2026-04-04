import { vi } from "vitest";

/** Standard gamePersistence mock — use vi.mock("./gamePersistence", ...) in each test file */
export const gamePersistenceMock = {
  saveGameState: vi.fn(),
  clearGameState: vi.fn(),
  loadGameStates: vi.fn().mockResolvedValue(new Map()),
};
