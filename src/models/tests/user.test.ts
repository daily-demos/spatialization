document.body.innerHTML =
  '<div id="focus">' +
  '<div id="broadcast"></div>' +
  '<div id="zonemates"></div>' +
  "</div>";

import { User } from "../user";
import { AudioContext } from "standardized-audio-context-mock";
import {
  IAudioContext,
  IAudioListener,
  IMediaStreamAudioDestinationNode,
  IMediaStreamAudioSourceNode,
  IStereoPannerNode,
  StereoPannerNode,
  TChannelCountMode,
  TChannelInterpretation,
} from "standardized-audio-context";
import { globalZoneID } from "../../config";

declare global {
  interface Window {
    audioContext: IAudioContext;
  }
}

Object.defineProperty(window, "MediaStreamTrack", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({})),
});

Object.defineProperty(MediaStreamTrack, "isTypeSupported", {
  writable: true,
  value: () => true,
});

Object.defineProperty(window, "MediaStream", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    start: jest.fn(),
    getAudioTracks: jest.fn().mockReturnValue([]),
  })),
});

Object.defineProperty(MediaStream, "isTypeSupported", {
  writable: true,
  value: () => true,
});

Object.defineProperty(global.window.HTMLMediaElement.prototype, "play", {
  configurable: true,
  get() {
    setTimeout(() => this.onloadeddata && this.onloadeddata());
    return () => {};
  },
});

Object.defineProperty(window, "RTCPeerConnection", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    start: jest.fn(),
    createOffer: jest.fn(),
    createAnswer: jest.fn(),
    setLocalDescription: jest.fn(),
    setRemoteDescription: jest.fn(),
  })),
});

Object.defineProperty(RTCPeerConnection, "isTypeSupported", {
  writable: true,
  value: () => true,
});

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
    expect(remote.media.stereoPannerNode.pan.value).toBe(wantPan);
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
    expect(remote.media.stereoPannerNode.pan.value).toBe(wantPan);
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
    expect(remote.media.stereoPannerNode.pan.value).toBe(0.5);
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
    expect(remote.media.stereoPannerNode.pan.value).toBe(-0.5);
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
    expect(remote.media.stereoPannerNode.pan.value).toBe(0);
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
    u1["earshotDistance"] = 100;
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

  createStereoPanner(): IStereoPannerNode<IAudioContext> {
    return <StereoPannerNode<IAudioContext>>{
      pan: <AudioParam>{
        value: 0,
      },
      channelCount: 1,
      channelCountMode: <TChannelCountMode>{},
      channelInterpretation: <TChannelInterpretation>{},
      context: <IAudioContext>{},
      numberOfInputs: 1,
      numberOfOutputs: 1,
      connect: () => {},
      disconnect: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: (): boolean => {
        return true;
      },
    };
  }

  createMediaStreamSource(): IMediaStreamAudioSourceNode<this> {
    /*   return <IMediaStreamAudioSourceNode<this>> {
      connect = () => {},
    } */
    const s = super.createMediaStreamSource();
    s.connect = () => {};
    return s;
  }

  createMediaStreamDestination(): IMediaStreamAudioDestinationNode<this> {
    return <IMediaStreamAudioDestinationNode<this>>{
      stream: new MediaStream(),
    };
  }
}
