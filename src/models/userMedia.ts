import {
  PannerNode,
  StereoPannerNode,
  AudioContext,
} from "standardized-audio-context";
import { showZonemate } from "../util/nav";
import { Pos } from "../worldTypes";

export const maxPannerDistance = 1000;

// UserMedia holds all audio and video related tags,
// streams, and panners for a user.
export class UserMedia {
  private videoTrack: MediaStreamTrack;
  private audioTrack: MediaStreamTrack;

  videoTag: HTMLVideoElement;
  audioTag: HTMLAudioElement;

  pannerNode: PannerNode<AudioContext>;
  stereoPannerNode: StereoPannerNode<AudioContext>;

  streamToZone: boolean;
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
    video.classList.add("invisible");
    document.documentElement.appendChild(video);
    this.videoTag = video;
  }

  private createAudioTag() {
    // Set up audio tag
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.classList.add("invisible");
    document.documentElement.appendChild(audio);
    this.audioTag = audio;
  }

  updateVideoSource(newTrack: MediaStreamTrack) {
    if (!newTrack) {
      this.videoTag.style.opacity = "0";
      return;
    }
    this.videoTag.style.opacity = "1";
    if (newTrack.id === this.videoTrack?.id) return;
    this.videoTrack = newTrack;
    this.videoTag.srcObject = new MediaStream([newTrack]);
    if (this.streamToZone) {
      this.showOrUpdateZonemate();
    }
  }

  updateAudioSource(newTrack: MediaStreamTrack) {
    if (!this.audioTag) return;
    if (!newTrack) {
      this.muteAudio();
      return;
    }
    this.unmuteAudio();

    if (newTrack.id === this.audioTrack?.id) {
      return;
    }
    this.audioTrack = newTrack;
    this.audioTag.srcObject = new MediaStream([newTrack]);
    // Reset panner node
    this.pannerNode = null;
    if (this.streamToZone) {
      this.showOrUpdateZonemate();
    }
  }

  muteAudio() {
    if (!this.audioTag.muted) this.audioTag.muted = true;
  }

  unmuteAudio() {
    if (this.audioTag.muted) this.audioTag.muted = false;
  }

  getVideoTrack(): MediaStreamTrack {
    return this.videoTrack;
  }

  getAudioTrack(): MediaStreamTrack {
    return this.audioTrack;
  }

  updatePanner(pos: Pos, panValue: number) {
    if (!this.audioTag || !this.audioTrack) return;

    if (!this.pannerNode) {
      let gainNode = window.audioContext.createGain();
      gainNode.gain.setValueAtTime(1, window.audioContext.currentTime);

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
        refDistance: 1,
        maxDistance: maxPannerDistance,
        rolloffFactor: 1,
        coneInnerAngle: 60,
        coneOuterAngle: 90,
        coneOuterGain: 0.3,
      });

      this.stereoPannerNode = new StereoPannerNode(window.audioContext);

      // Get pan value
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
    } else {
      const currentX = this.pannerNode.positionX.value;
      const currentY = this.pannerNode.positionY.value;
      if (currentX !== pos.x || currentY !== pos.y) {
        this.pannerNode.positionX.value = pos.x;
        this.pannerNode.positionY.value = pos.y;
      }
      if (this.stereoPannerNode.pan.value != panValue) {
        this.stereoPannerNode.pan.value = panValue;
      }
    }
  }

  showOrUpdateZonemate() {
    let videoTrack = null;
    if (this.videoTag.style.opacity === "1") {
      videoTrack = this.videoTrack;
    }
    showZonemate(this.id, videoTrack, this.audioTrack);
  }
}
