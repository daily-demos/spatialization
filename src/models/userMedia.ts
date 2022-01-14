import {
  PannerNode,
  StereoPannerNode,
  AudioContext,
  GainNode,
} from "standardized-audio-context";
import { Loopback } from "../util/loopback";
import {
  removeZonemate,
  showBroadcast,
  showZonemate,
  stopBroadcast,
} from "../util/nav";

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
      window.userMedia.push(this);
    }
  }

  private createVideoTag() {
    // Set up video tag
    const video = document.createElement("video");
    video.autoplay = true;
    video.classList.add("fit");
    video.width = 75;
    video.height = 75;
    video.classList.add("invisible");
    document.documentElement.appendChild(video);
    this.videoTag = video;
  }

  private createAudioTag() {
    // Set up audio tag
    const audio = new Audio();
    audio.id = `tile-audio-${this.id}`;
    audio.autoplay = true;
    audio.classList.add("invisible");
    // document.documentElement.appendChild(audio);
    this.audioTag = audio;
  }

  updateVideoSource(newTrack: MediaStreamTrack) {
    if (!newTrack) {
      this.cameraDisabled = true;
      this.videoTag.style.opacity = "0";
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
    this.videoTag.style.opacity = "1";
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
      console.log("muted audio");
    }
  }

  unmuteAudio() {
    if (this.audioTag.muted) {
      this.audioTag.muted = false;
      console.log("unmuted audio");
    }
  }

  getVideoTrack(): MediaStreamTrack {
    return this.videoTrack;
  }

  getAudioTrack(): MediaStreamTrack {
    return this.audioTrack;
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
    removeZonemate(this.id);
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
    // https://bugs.chromium.org/p/chromium/issues/detail?id=687574
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
    // when using Web Audio API in Chromium:
    // https://bugs.chromium.org/p/chromium/issues/detail?id=687574
    this.loopback = new Loopback();
    await this.loopback.start(destination.stream);
    const loopbackStream = this.loopback.getLoopback();
    console.log("loopback:", loopbackStream);
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
