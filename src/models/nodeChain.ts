import {
  AudioContext,
  IMediaStreamAudioDestinationNode,
  IGainNode,
  IStereoPannerNode,
  IDynamicsCompressorNode,
  IMediaStreamAudioSourceNode,
} from "standardized-audio-context";
import Loopback from "../util/loopback";

const isChrome: boolean = !!(navigator.userAgent.indexOf("Chrome") !== -1);

// NodeChain is responsible for creating, destroying, and connecting our
// Web Audio API nodes.
export default class NodeChain {
  initialized: boolean;

  private source: IMediaStreamAudioSourceNode<AudioContext>;

  private destination: IMediaStreamAudioDestinationNode<AudioContext>;

  private gain: IGainNode<AudioContext>;

  private stereoPanner: IStereoPannerNode<AudioContext>;

  private compressor: IDynamicsCompressorNode<AudioContext>;

  private loopback: Loopback;

  // Apparently this is required due to a Chromium bug!
  // https://bugs.chromium.org/p/chromium/issues/detail?id=933677
  // https://stackoverflow.com/questions/55703316/audio-from-rtcpeerconnection-is-not-audible-after-processing-in-audiocontext
  private mutedAudio: HTMLAudioElement;

  constructor() {
    this.mutedAudio = new Audio();
    this.mutedAudio.muted = true;
  }

  getGain(): number {
    return this.gain?.gain.value;
  }

  updateGain(val: number) {
    if (this.gain.gain.value === val) return;
    try {
      this.gain.gain.setValueAtTime(val, window.audioContext.currentTime);
    } catch (e) {
      console.error(`failed to update gain: ${e} (gain value: ${val})`);
    }
  }

  getPan(): number {
    return this.stereoPanner?.pan.value;
  }

  updatePan(val: number) {
    if (this.stereoPanner.pan.value === val) return;
    try {
      this.stereoPanner.pan.setValueAtTime(
        val,
        window.audioContext.currentTime,
      );
    } catch (e) {
      console.error(`failed to update pan: ${e} (pan value: ${val})`);
    }
  }

  async init(track: MediaStreamTrack): Promise<MediaStream> {
    const stream = new MediaStream([track]);

    this.mutedAudio.srcObject = stream;
    this.mutedAudio.autoplay = true;

    this.gain = window.audioContext.createGain();
    this.stereoPanner = window.audioContext.createStereoPanner();
    this.compressor = window.audioContext.createDynamicsCompressor();
    this.source = window.audioContext.createMediaStreamSource(stream);
    this.destination = window.audioContext.createMediaStreamDestination();

    this.source.connect(this.gain);
    this.gain.connect(this.stereoPanner);
    this.stereoPanner.connect(this.compressor);
    this.compressor.connect(this.destination);

    let srcStream: MediaStream;

    // This is a workaround for there being no echo cancellation
    // when using Web Audio API in Chrome (another bug):
    // https://bugs.chromium.org/p/chromium/issues/detail?id=687574
    if (isChrome) {
      this.loopback = new Loopback();
      await this.loopback.start(this.destination.stream);
      srcStream = this.loopback.getLoopback();
    } else {
      srcStream = this.destination.stream;
    }
    this.initialized = true;
    return srcStream;
  }

  destroy() {
    if (!this.initialized) return;
    this.initialized = false;
    this.source.disconnect();
    this.destination.disconnect();
    this.gain.disconnect();
    this.stereoPanner.disconnect();
    this.compressor.disconnect();
    this.loopback?.destroy();
    this.source = null;
    this.destination = null;
    this.gain = null;
    this.stereoPanner = null;
    this.compressor = null;
    this.loopback = null;
    this.mutedAudio.pause();
    this.mutedAudio.srcObject = null;
  }
}
