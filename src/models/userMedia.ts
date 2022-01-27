import {
  StereoPannerNode,
  AudioContext,
  GainNode,
} from "standardized-audio-context";
import { standardTileSize } from "../config";
import { Loopback } from "../util/loopback";
import {
  removeZonemate,
  showBroadcast,
  showZonemate,
  stopBroadcast,
} from "../util/tile";

export const maxPannerDistance = 1000;

export enum Action {
  Traversing,
  InZone,
  Broadcasting,
}

const isChrome: boolean = !!(navigator.userAgent.indexOf("Chrome") !== -1);
console.log("IsChrome", isChrome);

// UserMedia holds all audio and video related tags,
// streams, and panners for a user.
export class UserMedia {
  private videoTrack: MediaStreamTrack;
  private audioTrack: MediaStreamTrack;
  private _videoPlaying = false;

  videoTag: HTMLVideoElement;
  audioTag: HTMLAudioElement;

  videoDelayedPlayHandler: () => void;

  cameraDisabled: boolean;
  tileDisabled: boolean;

  gainNode: GainNode<AudioContext>;
  stereoPannerNode: StereoPannerNode<AudioContext>;

  currentAction: Action = Action.Traversing;
  id: string;
  userName: string;
  loopback: Loopback;

  constructor(id: string, userName: string, isLocal: boolean) {
    this.id = id;
    if (!userName) {
      userName = id;
    }
    this.userName = userName;
    this.createVideoTag();
    if (!isLocal) {
      this.createAudioTag();
    }
  }

  // This is called a "delayed" video play handler, because
  // it is intended specifically for not just the video "onpaying"
  // event firing, but the video ALSO having been playing for at
  // > 0s. Reasoning being that if video.currentTime is at 0,
  // the Sprite video texture amy freeze.
  public setDelayedVideoPlayHandler(f: () => void) {
    this.videoDelayedPlayHandler = f;
  }

  public addVideoResizeHandler(f: (e: UIEvent) => void) {
    this.videoTag.onresize = (e) => {
      this.videoPlaying = false;
      this.registerPlay();
      f(e);
    };
  }

  public resetVideoResizeHandler() {
    this.videoTag.onresize = (e) => {
      // After resizing, video goes back to currentTime 0
      // Which for our purposes is NOT PLAYING.
      // So set bool to false and register play again.
      this.videoPlaying = false;
      this.registerPlay();
    };
  }

  public get videoPlaying(): boolean {
    return this._videoPlaying;
  }

  public set videoPlaying(value: boolean) {
    this._videoPlaying = value;
    if (value === true && this.videoDelayedPlayHandler) {
      this.videoDelayedPlayHandler();
    }
  }

  private async registerPlay() {
    while (this.videoTag.currentTime === 0) {
      console.log("still waiting for timestamp: ", this.videoTag.currentTime);
      await new Promise((r) => setTimeout(r, 10));
    }
    this.videoPlaying = true;
  }

  private async createVideoTag() {
    // Set up video tag
    const video = document.createElement("video");

    video.oncanplay = () => {
      if (!this.videoPlaying) {
        video.play().catch((err) => {
          console.log("failed to play after oncanplay event: ", err);
        });
      }
    };

    video.autoplay = true;
    video.classList.add("inWorldVideo");
    video.width = standardTileSize;
    video.height = standardTileSize;
    video.classList.add("invisible");
    document.documentElement.appendChild(video);

    video.onplaying = async () => {
      await this.registerPlay();
    };

    video.onpause = () => {
      this.videoPlaying = false;
      console.warn("video paused.", this.userName);
    };

    video.onended = () => {
      this.videoPlaying = false;
      console.warn("video ended.", this.userName);
    };

    this.videoTag = video;

    this.resetVideoResizeHandler();
  }

  private createAudioTag() {
    // Set up audio tag
    const audio = new Audio();
    audio.id = `tile-audio-${this.id}`;
    audio.autoplay = true;
    audio.classList.add("invisible");
    this.audioTag = audio;
  }

  updateVideoSource(newTrack: MediaStreamTrack) {
    if (!newTrack) {
      this.cameraDisabled = true;
      if (this.currentAction === Action.InZone) {
        this.showOrUpdateZonemate();
        return;
      }
      if (this.currentAction === Action.Broadcasting) {
        this.showOrUpdateBroadcast();
      }
      return;
    }
    this.cameraDisabled = false;
    if (newTrack.id !== this.videoTrack?.id) {
      this.videoTrack = newTrack;
      this.videoTag.srcObject = new MediaStream([newTrack]);
    }

    if (this.currentAction === Action.InZone) {
      this.showOrUpdateZonemate();
      return;
    }
    if (this.currentAction === Action.Broadcasting) {
      this.showOrUpdateBroadcast();
    }
  }

  updateAudioSource(newTrack: MediaStreamTrack) {
    if (!this.audioTag) return;
    if (!newTrack) {
      return;
    }

    if (newTrack.id === this.audioTrack?.id) {
      return;
    }
    this.audioTrack = newTrack;

    // Reset nodes
    console.log("resetting audio nodes");
    const gain = this.gainNode?.gain?.value;
    const pan = this.stereoPannerNode?.pan?.value;

    this.gainNode = null;
    this.stereoPannerNode = null;
    this.loopback?.destroy();
    this.loopback = null;

    // Recreate audio nodes with previous gain and pan
    if (gain && pan) {
      this.createAudioNodes(gain, pan);
    }

    if (this.currentAction === Action.InZone) {
      this.showOrUpdateZonemate();
      return;
    }
    if (this.currentAction === Action.Broadcasting) {
      this.showOrUpdateBroadcast();
    }
  }

  muteAudio() {
    if (!this.audioTag.muted) {
      this.audioTag.muted = true;
    }
  }

  unmuteAudio() {
    if (this.audioTag.muted) {
      this.audioTag.muted = false;
    }
  }

  getVideoTrack(): MediaStreamTrack {
    return this.videoTrack;
  }

  getAudioTrack(): MediaStreamTrack {
    return this.audioTrack;
  }

  enterZone() {
    this.currentAction = Action.InZone;
    this.showOrUpdateZonemate();
  }

  leaveZone() {
    this.currentAction = Action.Traversing;
    removeZonemate(this.id);
  }

  enterBroadcast() {
    if (this.audioTag) this.muteAudio();
    this.currentAction = Action.Broadcasting;
    this.showOrUpdateBroadcast();
  }

  leaveBroadcast() {
    this.currentAction = Action.Traversing;
    stopBroadcast();
  }

  updateAudio(gainValue: number, panValue: number) {
    if (!this.audioTag || !this.audioTrack) return;
    if (!this.gainNode) {
      this.createAudioNodes(gainValue, panValue);
      return;
    }

    if (this.gainNode.gain.value != gainValue) {
      try {
        this.gainNode.gain.setValueAtTime(
          gainValue,
          window.audioContext.currentTime
        );
      } catch (e) {
        console.error(`failed to update gain: ${e} (gain value: ${gainValue})`);
      }
    }

    if (this.stereoPannerNode.pan.value != panValue) {
      try {
        this.stereoPannerNode.pan.setValueAtTime(
          panValue,
          window.audioContext.currentTime
        );
      } catch (e) {
        console.error(`failed to update pan: ${e} (pan value: ${panValue})`);
      }
    }
  }

  destroy() {
    console.log("destroying media", this.id);
    this.loopback?.destroy();
    delete this.loopback;
    this.audioTag?.remove();
    this.videoTag.oncanplay = null;
    this.videoTag.onresize = null;
    this.videoTag.onplaying = null;
    this.videoTag.onended = null;
    this.videoTag.onpause = null;
    this.videoTag.remove();
  }

  private async createAudioNodes(gainValue: number, panValue: number) {
    const stream = new MediaStream([this.audioTrack]);

    this.gainNode = window.audioContext.createGain();
    this.gainNode.gain.value = gainValue;

    this.stereoPannerNode = window.audioContext.createStereoPanner();

    this.stereoPannerNode.pan.value = panValue;

    const compressor = window.audioContext.createDynamicsCompressor();

    const source = window.audioContext.createMediaStreamSource(stream);
    const destination = window.audioContext.createMediaStreamDestination();

    // Apparently this is required due to a Chromium bug!
    // https://bugs.chromium.org/p/chromium/issues/detail?id=933677
    // https://stackoverflow.com/questions/55703316/audio-from-rtcpeerconnection-is-not-audible-after-processing-in-audiocontext
    const mutedAudio = new Audio();
    mutedAudio.muted = true;
    mutedAudio.srcObject = stream;
    mutedAudio.play();

    source.connect(this.gainNode);
    this.gainNode.connect(this.stereoPannerNode);
    this.stereoPannerNode.connect(compressor);
    compressor.connect(destination);

    let srcStream: MediaStream;

    // This is a workaround for there being no noise cancellation
    // when using Web Audio API in Chrome (another bug):
    // https://bugs.chromium.org/p/chromium/issues/detail?id=687574
    if (isChrome) {
      this.loopback = new Loopback();
      await this.loopback.start(destination.stream);
      srcStream = this.loopback.getLoopback();
    } else {
      srcStream = destination.stream;
    }

    this.audioTag.muted = false;
    this.audioTag.srcObject = srcStream;
    this.audioTag.play();
  }

  showOrUpdateZonemate() {
    let videoTrack = null;
    if (this.videoTrack && !this.cameraDisabled) {
      videoTrack = this.videoTrack;
    }
    showZonemate(this.id, this.userName, videoTrack, this.audioTrack);
  }

  showOrUpdateBroadcast() {
    let videoTrack = null;
    if (this.videoTrack && !this.cameraDisabled) {
      videoTrack = this.videoTrack;
    }
    showBroadcast(this.userName, videoTrack, this.audioTrack);
  }
}
