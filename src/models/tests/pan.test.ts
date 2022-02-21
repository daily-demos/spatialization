import { MockAudioContext, mockBody } from "./mock";
mockBody();

import { globalZoneID } from "../../config";
import { User } from "../user";

describe("User panner tests", () => {
  test("Pan: speaker on the max right of listener", () => {
    const audioCtx = new MockAudioContext();
    window.audioContext = audioCtx;

    const local = new User("local", null, 100, 100, true);
    local["earshotDistance"] = 100;
    local["zoneData"].zoneID = globalZoneID;

    const remote = new User("remote", null, 200, 100);
    remote.media["audioTrack"] = new MediaStreamTrack();
    remote["zoneData"].zoneID = globalZoneID;

    const wantPan = 1;
    const pannerMod = local["getAudioMod"](100, remote.getPos());
    expect(pannerMod.pan).toBe(wantPan);

    local.processUsers([remote]);

    const nodeChain = remote.media["nodeChain"];
    expect(nodeChain.getPan()).toBe(wantPan);
  });

  test("Pan: speaker on the max left of listener", () => {
    const audioCtx = new MockAudioContext();
    window.audioContext = audioCtx;

    const local = new User("local", null, 100, 100, true);
    local["earshotDistance"] = 100;

    const remote = new User("remote", null, 0, 100);
    remote.media["audioTrack"] = new MediaStreamTrack();

    const wantPan = -1;
    const pannerMod = local["getAudioMod"](100, remote.getPos());
    expect(pannerMod.pan).toBe(wantPan);

    local.processUsers([remote]);

    const nodeChain = remote.media["nodeChain"];
    expect(nodeChain.getPan()).toBe(wantPan);
  });

  test("Pan: speaker on the partial right of listener", () => {
    const audioCtx = new MockAudioContext();
    window.audioContext = audioCtx;

    const local = new User("local", null, 100, 100, true);
    local["earshotDistance"] = 100;

    const remote = new User("remote", null, 150, 100);
    remote.media["audioTrack"] = new MediaStreamTrack();

    const pannerMod = local["getAudioMod"](50, remote.getPos());
    expect(pannerMod.pan).toBe(0.5);

    local.processUsers([remote]);
    const nodeChain = remote.media["nodeChain"];
    expect(nodeChain.getPan()).toBe(0.5);
  });

  test("Pan: speaker on the partial left of listener", () => {
    const audioCtx = new MockAudioContext();
    window.audioContext = audioCtx;

    const local = new User("local", null, 100, 100, true);
    local["earshotDistance"] = 100;

    const remote = new User("remote", null, 50, 100);
    remote.media["audioTrack"] = new MediaStreamTrack();

    const pannerMod = local["getAudioMod"](50, remote.getPos());
    expect(pannerMod.pan).toBe(-0.5);

    local.processUsers([remote]);
    const nodeChain = remote.media["nodeChain"];
    expect(nodeChain.getPan()).toBe(-0.5);
  });

  test("Pan: speaker in the center of the listener", () => {
    const audioCtx = new MockAudioContext();
    window.audioContext = audioCtx;

    const local = new User("local", null, 100, 100, true);
    local["earshotDistance"] = 100;

    const remote = new User("remote", null, 100, 199);
    remote.media["audioTrack"] = new MediaStreamTrack();

    const pannerMod = local["getAudioMod"](100, remote.getPos());
    expect(pannerMod.pan).toBe(0);

    local.processUsers([remote]);
    const nodeChain = remote.media["nodeChain"];
    expect(nodeChain.getPan()).toBe(0);
  });
});
