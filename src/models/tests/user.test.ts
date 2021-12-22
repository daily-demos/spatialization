import { User } from "../user";
import { AudioContext } from "standardized-audio-context-mock";
import { IAudioContext, IAudioListener } from "standardized-audio-context";

declare global {
  interface Window {
    audioContext: IAudioContext;
  }
}

describe("User listener and panner tests", () => {
  test("Listener initial position", () => {
    const audioCtx = new MockAudioContext();
    window.audioContext = audioCtx;
    const user = new User("test", "test", 100, 100, true);
    // This should update the listener
    user.moveTo(150, 150);
    const l = window.audioContext.listener;
    expect(l.positionX.value === user.position.x).toBe(true);
    expect(l.positionY.value === user.position.y).toBe(true);
  });
});

type Mutable<T> = {
  -readonly [k in keyof T]: T[k];
};

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
