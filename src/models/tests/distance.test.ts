import { mockBody } from "./mock";
mockBody();

import { User } from "../user";

describe("Distance and earshot tests", () => {
  mockBody();
  test("Distance calculation", () => {
    mockBody();

    const u1 = new User({ id: "test1", x: 100, y: 100, isLocal: true });
    const u2 = new User({ id: "test2", x: 200, y: 200 });
    const wantDistance = 141;
    const gotDistance = u1["distanceTo"](u2);
    expect(gotDistance).toBe(wantDistance);
  });

  test("User earshot", () => {
    const u1 = new User({ id: "t", x: 100, y: 100, isLocal: true });
    u1["earshotDistance"] = 100;
    const ie1 = u1["inEarshot"](100);
    expect(ie1).toBe(true);

    const ie2 = u1["inEarshot"](301);
    expect(ie2).toBe(false);
  });
});
