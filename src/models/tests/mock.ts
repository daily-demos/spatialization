import { AudioContext } from "standardized-audio-context-mock";
import {
  IAudioContext,
  IMediaStreamAudioDestinationNode,
  IMediaStreamAudioSourceNode,
  IStereoPannerNode,
  TChannelCountMode,
  TChannelInterpretation,
} from "standardized-audio-context";

declare global {
  interface Window {
    audioContext: IAudioContext;
  }
}

Object.defineProperty(window, "MediaStreamTrack", {
  writable: true,
  value: jest.fn().mockImplementation(() => ({})),
});

Object.defineProperty(window, "MediaStream", {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    getAudioTracks: jest.fn().mockReturnValue([]),
  })),
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

export class MockAudioContext extends AudioContext {
  constructor() {
    super();
  }

  createStereoPanner(): IStereoPannerNode<IAudioContext> {
    const node: any = {
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

    node.pan.setValueAtTime = (pan: number, time: number) => {
      node.pan.value = pan;
    };

    return node;
  }

  createMediaStreamSource(): IMediaStreamAudioSourceNode<this> {
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

export function mockBody() {
  document.body.innerHTML =
    '<div id="focus">' +
    '<div id="broadcast"></div>' +
    '<div id="zonemates"></div>' +
    "</div>";
}
