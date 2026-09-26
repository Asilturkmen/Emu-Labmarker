import { describe, expect, it } from "vitest";

import { isValidRoomCode } from "../src/data/labRooms";

describe("isValidRoomCode", () => {
  it("accepts room codes however they are typed", () => {
    for (const room of ["CMPE025", "cmpe 025", " cl114 ", "CL 116", "LAB1"]) {
      expect(isValidRoomCode(room), room).toBe(true);
    }
  });

  it("rejects anything that cannot be a room code", () => {
    for (const room of ["", "  ", "C1", "1234", "CMPE-025!", "A".repeat(17)]) {
      expect(isValidRoomCode(room), JSON.stringify(room)).toBe(false);
    }
  });
});
