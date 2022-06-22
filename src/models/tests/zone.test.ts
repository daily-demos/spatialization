import { mockBody } from "./mock";
mockBody();

import { User } from "../user";

describe("User zone tests", () => {
  test("Users enter and leave proximity", () => {
    const lu = new User({
      id: "local",
      x: 100,
      y: 100,
      isLocal: true,
    });
    lu["earshotDistance"] = 300;

    const ru = new User({
      id: "remote",
      x: 200,
      y: 200,
      isLocal: false,
    });
    // Right now, both users are in the same zone and within
    // earshot distance. So they should be in the same vicinity
    // and earshot.
    lu.processUsers([ru]);
    expect(ru.isInVicinity).toBe(true);
    expect(ru.media.audioTag.muted).toBe(false);

    // Remote user steps away
    ru.moveTo({ x: 1000, y: 1000 });
    lu.processUsers([ru]);
    expect(ru.isInVicinity).toBe(false);
    expect(ru.media.audioTag.muted).toBe(true);
  });

  test("Remote user leaves default zone", () => {
    const lu = new User({
      id: "local",
      userName: null,
      x: 100,
      y: 100,
      isLocal: true,
    });
    lu["earshotDistance"] = 300;

    const ru = new User({ id: "remote", userName: null, x: 200, y: 200 });

    ru.updateZone(1);
    expect(ru.getZoneData().zoneID).toBe(1);

    lu.processUsers([ru]);
    // Since the user is now in a different zone, they should
    // not be in the vicinity or earshot, AND they should be
    // muted
    expect(ru.isInVicinity).toBe(false);
    expect(ru.media.audioTag.muted).toBe(true);
  });

  test("Local user joins non-default zone", () => {
    const lu = new User({
      id: "local",
      userName: null,
      x: 100,
      y: 100,
      isLocal: true,
    });
    lu["earshotDistance"] = 300;

    const ru = new User({ id: "remote", userName: null, x: 1000, y: 1000 });
    ru.updateZone(2);
    lu.updateZone(2);

    // Both users are now within the same non-default zone.
    lu.processUsers([ru]);
    expect(ru.isInVicinity).toBe(true);
    expect(ru.media.audioTag.muted).toBe(true);
  });
});
