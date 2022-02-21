import { mockBody } from "./mock";
mockBody();

import { User } from "../user";

describe("Distance and earshot tests", () => {
  mockBody();
  test("Distance calculation", () => {
    mockBody();

    const u1 = new User("test1", null, 100, 100, true);
    const u2 = new User("test2", null, 200, 200, true);
    const wantDistance = 141;
    const gotDistance = u1["distanceTo"](u2);
    expect(gotDistance).toBe(wantDistance);
  });

  test("User earshot", () => {
    const u1 = new User("t", null, 100, 100, true);
    u1["earshotDistance"] = 100;
    const ie1 = u1["inEarshot"](100);
    expect(ie1).toBe(true);

    const ie2 = u1["inEarshot"](301);
    expect(ie2).toBe(false);
  });
});
