// eslint-disable-next-line import/no-extraneous-dependencies
import { IAudioContext } from "standardized-audio-context";

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
  value: jest.fn().mockImplementation((_query) => ({
    start: jest.fn(),
    createOffer: jest.fn(),
    createAnswer: jest.fn(),
    setLocalDescription: jest.fn(),
    setRemoteDescription: jest.fn(),
  })),
});

export default function mockBody() {
  document.body.innerHTML =
    '<div id="focus">' +
    '<div id="broadcast"></div>' +
    '<div id="zonemates"></div>' +
    "</div>";
  console.log("mocked body", document.body.innerHTML);
}
