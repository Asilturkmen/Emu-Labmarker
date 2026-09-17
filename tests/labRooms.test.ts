import { describe, expect, it } from "vitest";

import {
  addRoomToList,
  isValidRoomCode,
  MAX_CUSTOM_ROOMS,
  removeRoomFromList,
} from "../src/data/labRooms";

const VERIFIED = new Set(["CMPE134", "CMPE230"]);

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

describe("addRoomToList", () => {
  it("normalizes the room before storing it", () => {
    expect(addRoomToList([], "cmpe 025", VERIFIED)).toMatchObject({
      status: "added",
      room: "CMPE025",
      rooms: ["CMPE025"],
    });
  });

  it("accepts a whole timetable entry pasted from the portal", () => {
    expect(addRoomToList([], "CMSE423/CMPE025", VERIFIED)).toMatchObject({
      status: "added",
      room: "CMPE025",
    });
    expect(addRoomToList([], "MGMT101/CL 116", VERIFIED)).toMatchObject({
      status: "added",
      room: "CL116",
    });
  });

  it("keeps the existing list on every rejection", () => {
    const rooms = ["CMPE025"];

    const invalid = addRoomToList(rooms, "??", VERIFIED);
    const duplicate = addRoomToList(rooms, "cmpe 025", VERIFIED);
    const verified = addRoomToList(rooms, "CMPE134", VERIFIED);

    expect(invalid.status).toBe("invalid");
    expect(duplicate.status).toBe("duplicate");
    expect(verified.status).toBe("verified");
    for (const result of [invalid, duplicate, verified]) {
      expect(result.rooms).toEqual(["CMPE025"]);
    }
  });

  it("stops at the list limit", () => {
    const rooms = Array.from(
      { length: MAX_CUSTOM_ROOMS },
      (_unused, index) => `CL${index + 100}`,
    );

    expect(addRoomToList(rooms, "CMPE025", VERIFIED)).toMatchObject({
      status: "limit",
      rooms,
    });
  });

  it("does not modify the list it was given", () => {
    const rooms = ["CMPE025"];

    addRoomToList(rooms, "CL116", VERIFIED);

    expect(rooms).toEqual(["CMPE025"]);
  });
});

describe("removeRoomFromList", () => {
  it("removes the room however it is written", () => {
    expect(removeRoomFromList(["CMPE025", "CL116"], "cmpe 025")).toEqual([
      "CL116",
    ]);
  });

  it("leaves the list alone when the room is not in it", () => {
    expect(removeRoomFromList(["CMPE025"], "CL116")).toEqual(["CMPE025"]);
  });
});
