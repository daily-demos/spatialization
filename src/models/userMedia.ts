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

// UserMedia holds all audio and video related tags,
// streams, and panners for a user.
export class UserMedia {
  private videoTrack: MediaStreamTrack;
  private audioTrack: MediaStreamTrack;
  private videoPlaying = false;

  videoTag: HTMLVideoElement;
  audioTag: HTMLAudioElement;

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

  public videoIsPlaying(): boolean {
    return this.videoPlaying;
  }

  public addVideoPlayHandler(f: Function) {
    this.videoTag.onplaying = async () => {
      await this.registerPlay();
      f();
    };
  }

  public resetVideoPlayHandler() {
    this.videoTag.onplaying = async () => {
      await this.registerPlay();
    };
  }

  private async registerPlay() {
    await new Promise((r) => setTimeout(r, 1000));
    this.videoPlaying = true;
  }

  private async createVideoTag() {
    // Set up video tag
    const video = document.createElement("video");
    video.autoplay = true;
    video.classList.add("fit");
    video.width = standardTileSize;
    video.height = standardTileSize;
    video.classList.add("invisible");
    document.documentElement.appendChild(video);
    video.play().catch((err) => {
      console.log("failed to play initial video: ", err);
    });

    video.oncanplay = () => {
      console.log("can play", this.userName);
      if (!this.videoIsPlaying()) {
        video.play().catch((err) => {
          console.log("failed to play after oncanplay event: ", err);
        });
      }
    };

    video.onpause = () => {
      this.videoPlaying = false;
      console.warn("video paused.");
    };

    video.onended = () => {
      this.videoPlaying = false;
      console.warn("video ended.");
    };

    this.videoTag = video;
    this.resetVideoPlayHandler();
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
    this.gainNode = null;
    this.stereoPannerNode = null;

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
    this.loopback?.destroy();
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

    // This is a workaround for there being no noise cancellation
    // when using Web Audio API in Chromium (another bug):
    // https://bugs.chromium.org/p/chromium/issues/detail?id=687574
    this.loopback = new Loopback();
    await this.loopback.start(destination.stream);
    const loopbackStream = this.loopback.getLoopback();
    this.audioTag.muted = false;
    this.audioTag.srcObject = loopbackStream;
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
