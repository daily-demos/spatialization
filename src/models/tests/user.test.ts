import { User } from "../user";
import { AudioContext } from "standardized-audio-context-mock";
import { IAudioContext, IAudioListener } from "standardized-audio-context";

declare global {
  interface Window {
    audioContext: IAudioContext;
  }
}

describe("User listener and panner tests", () => {
  test("Listener position", () => {
    const audioCtx = new MockAudioContext();
    window.audioContext = audioCtx;
    const user = new User("test", null, 100, 100, true);

    // This should update the listener
    user.moveTo({ x: 150, y: 150 });
    const l = window.audioContext.listener;
    expect(l.positionX.value).toBe(user.position.x);
    expect(l.positionY.value).toBe(user.position.y);
  });

  test("Pan: speaker on the max right of listener", () => {
    const audioCtx = new MockAudioContext();
    window.audioContext = audioCtx;

    const listener = new User("local", null, 100, 100, true);
    listener["earshotDistance"] = 100;

    const speakerPos = { x: 200, y: 100 };
    const pannerMod = listener["getAudioMod"](100, speakerPos);
    expect(pannerMod.pan).toBe(1);
  });

  test("Pan: speaker on the max left of listener", () => {
    const audioCtx = new MockAudioContext();
    window.audioContext = audioCtx;

    const listener = new User("local", null, 100, 100, true);
    listener["earshotDistance"] = 100;

    const speakerPos = { x: 0, y: 100 };
    const pannerMod = listener["getAudioMod"](100, speakerPos);
    expect(pannerMod.pan).toBe(-1);
  });

  test("Pan: speaker on the partial right of listener", () => {
    const audioCtx = new MockAudioContext();
    window.audioContext = audioCtx;

    const listener = new User("local", null, 100, 100, true);
    listener["earshotDistance"] = 100;

    const speakerPos = { x: 150, y: 100 };
    const pannerMod = listener["getAudioMod"](50, speakerPos);
    expect(pannerMod.pan).toBe(0.5);
  });

  test("Pan: speaker on the partial left of listener", () => {
    const audioCtx = new MockAudioContext();
    window.audioContext = audioCtx;

    const listener = new User("local", null, 100, 100, true);
    listener["earshotDistance"] = 100;

    const speakerPos = { x: 50, y: 100 };
    const pannerMod = listener["getAudioMod"](50, speakerPos);
    expect(pannerMod.pan).toBe(-0.5);
  });

  test("Pan: speaker in the center of the listener", () => {
    const audioCtx = new MockAudioContext();
    window.audioContext = audioCtx;

    const listener = new User("local", null, 100, 100, true);
    listener["earshotDistance"] = 100;

    const speakerPos = { x: 100, y: 200 };
    const pannerMod = listener["getAudioMod"](100, speakerPos);
    expect(pannerMod.pan).toBe(0);
  });
});

describe("Distance and earshot tests", () => {
  test("Distance calculation", () => {
    const u1 = new User("test1", null, 100, 100, true);
    const u2 = new User("test2", null, 200, 200, true);
    const wantDistance = 141;
    const gotDistance = u1["distanceTo"](u2);
    expect(gotDistance === wantDistance).toBe(true);
  });

  test("User earshot", () => {
    const u1 = new User("t", null, 100, 100, true);
    const ie1 = u1["inEarshot"](100);
    expect(ie1).toBe(true);

    const ie2 = u1["inEarshot"](301);
    expect(ie2).toBe(false);
  });
});

describe("User zone tests", () => {
  test("Users enter and leave proximity", () => {
    const lu = new User("local", null, 100, 100, true);
    lu["earshotDistance"] = 300;

    const ru = new User("remote", null, 200, 200, false);
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
    const lu = new User("local", null, 100, 100, true);
    lu["earshotDistance"] = 300;

    const ru = new User("remote", null, 200, 200, false);

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
    const lu = new User("local", null, 100, 100, true);
    lu["earshotDistance"] = 300;

    const ru = new User("remote", null, 1000, 1000, false);
    ru.updateZone(2);
    lu.updateZone(2);

    // Both users are now within the same non-default zone.
    lu.processUsers([ru]);
    expect(ru.isInVicinity).toBe(true);
    expect(ru.media.audioTag.muted).toBe(true);
  });
});

class MockAudioContext extends AudioContext {
  _listener: AudioListener;
  constructor() {
    super();
    this._listener = <AudioListener>{
      positionX: <AudioParam>{
        value: 0,
      },
      positionY: <AudioParam>{
        value: 0,
      },
      positionZ: <AudioParam>{},
      forwardX: <AudioParam>{},
      forwardY: <AudioParam>{},
      forwardZ: <AudioParam>{},
      upX: <AudioParam>{},
      upY: <AudioParam>{},
      upZ: <AudioParam>{},
    };
  }

  get listener(): IAudioListener {
    return this._listener;
  }
}
