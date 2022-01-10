import {
  PannerNode,
  StereoPannerNode,
  AudioContext,
} from "standardized-audio-context";
import {
  removeZonemate,
  showBroadcast,
  showZonemate,
  stopBroadcast,
} from "../util/nav";
import { Pos } from "../worldTypes";

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

  pannerNode: PannerNode<AudioContext>;
  stereoPannerNode: StereoPannerNode<AudioContext>;

  currentAction: Action = Action.Traversing;
  id: string;

  constructor(id: string, isLocal: boolean) {
    this.id = id;
    this.createVideoTag();
    if (!isLocal) {
      this.createAudioTag();
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
    audio.autoplay = true;
    audio.classList.add("invisible");
    (audio.muted = true), document.documentElement.appendChild(audio);
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
    this.audioTag.srcObject = new MediaStream([newTrack]);
    // Reset panner node
    this.pannerNode = null;
    if (this.currentAction === Action.InZone) {
      this.showOrUpdateZonemate();
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

  updatePanner(pos: Pos, panValue: number) {
    if (!this.audioTag || !this.audioTrack) return;

    if (!this.pannerNode) {
      this.createPannerNode(pos, panValue);
      return;
    }
    const currentX = this.pannerNode.positionX.value;
    const currentY = this.pannerNode.positionY.value;
    if (currentX !== pos.x || currentY !== pos.y) {
      try {
        this.pannerNode.positionX.value = pos.x;
        this.pannerNode.positionY.value = pos.y;
      } catch (e) {
        console.error(
          `failed to update panner position: ${e} (position: x: ${pos.x}, y: ${pos.y})`
        );
      }
    }
    if (this.stereoPannerNode.pan.value != panValue) {
      try {
        this.stereoPannerNode.pan.value = panValue;
      } catch (e) {
        console.error(
          `failed to update panner position: ${e} (pan value: ${panValue})`
        );
      }
    }
  }

  destroy() {
    removeZonemate(this.id);
  }

  private createPannerNode(pos: Pos, panValue: number) {
    const stream = new MediaStream([this.audioTrack]);

    this.pannerNode = new PannerNode(window.audioContext, {
      panningModel: "HRTF",
      distanceModel: "linear",
      positionX: pos.x,
      positionY: pos.y,
      positionZ: 300,
      orientationX: 0.0,
      orientationY: 0.0,
      orientationZ: -1.0,
      refDistance: 50,
      maxDistance: maxPannerDistance,
      rolloffFactor: 1,
      coneInnerAngle: 360,
      coneOuterAngle: 0,
      coneOuterGain: 1,
    });

    this.stereoPannerNode = new StereoPannerNode(window.audioContext);

    this.stereoPannerNode.pan.value = panValue;

    // Apparently this is required due to a Chromium bug!
    // https://bugs.chromium.org/p/chromium/issues/detail?id=687574
    // https://stackoverflow.com/questions/55703316/audio-from-rtcpeerconnection-is-not-audible-after-processing-in-audiocontext
    const mutedAudio = new Audio();
    mutedAudio.muted = true;
    mutedAudio.srcObject = stream;
    mutedAudio.play();

    const source = window.audioContext.createMediaStreamSource(stream);
    const destination = window.audioContext.createMediaStreamDestination();

    source.connect(this.pannerNode);
    this.pannerNode.connect(this.stereoPannerNode);
    this.stereoPannerNode.connect(destination);
    this.audioTag.muted = false;
    this.audioTag.srcObject = destination.stream;
    this.audioTag.play();
  }

  showOrUpdateZonemate() {
    let videoTrack = null;
    if (this.videoTrack && !this.cameraDisabled) {
      videoTrack = this.videoTrack;
    }
    showZonemate(this.id, videoTrack, this.audioTrack);
  }

  showOrUpdateBroadcast() {
    console.log("show or update broadcast", this.id);
    let videoTrack = null;
    if (this.videoTrack && !this.cameraDisabled) {
      videoTrack = this.videoTrack;
    }
    console.log("showOrUpdateBroadcast:", videoTrack, this.audioTrack);
    showBroadcast(videoTrack, this.audioTrack);
  }
}
