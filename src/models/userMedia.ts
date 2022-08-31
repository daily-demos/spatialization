import { standardTileSize } from "../config";
import { enableScreenBtn } from "../util/nav";
import {
  removeScreenShare,
  removeCamera,
  showBroadcast,
  showScreenShare,
  showCamera,
  stopBroadcast,
  initBroadcastDOM,
} from "../util/tile";
import NodeChain from "./nodeChain";

export const maxPannerDistance = 1000;

export enum Action {
  Traversing,
  InZone,
  Broadcasting,
}

// UserMedia holds all audio and video related tags,
// streams, and panners for a user.
export class UserMedia {
  videoTag: HTMLVideoElement;

  audioTag: HTMLAudioElement;

  cameraDisabled: boolean;

  currentAction: Action = Action.Traversing;

  userName: string;

  private videoTrack: MediaStreamTrack;

  private audioTrack: MediaStreamTrack;

  private screenTrack: MediaStreamTrack;

  private isVideoPlaying = false;

  private videoDelayedPlayHandler: () => void;

  private nodeChain = new NodeChain();

  private id: string;

  private toggleScreenControls: boolean;

  constructor(id: string, userName: string, isLocal: boolean) {
    this.id = id;
    let un = userName;
    if (!un) {
      un = id;
    }
    this.userName = un;
    this.createVideoTag();
    if (!isLocal) {
      this.createAudioTag();
      this.toggleScreenControls = true;
    }
    initBroadcastDOM();
  }

  // This is called a "delayed" video play handler, because
  // it is intended specifically for not just the video "onpaying"
  // event firing, but the video ALSO having been playing for at
  // > 0s. Reasoning being that if video.currentTime is at 0,
  // the Sprite video texture may freeze.
  public setDelayedVideoPlayHandler(f: () => void) {
    this.videoDelayedPlayHandler = f;
  }

  public addVideoResizeHandler(f: (e: UIEvent) => void) {
    this.videoTag.onresize = (e) => {
      this.setVideoPlaying(false);
      this.registerPlay();
      f(e);
    };
  }

  public resetVideoResizeHandler() {
    this.videoTag.onresize = () => {
      // After resizing, video goes back to currentTime 0
      // Which for our purposes is NOT PLAYING.
      // So set bool to false and register play again.
      this.setVideoPlaying(false);
      this.registerPlay();
    };
  }

  public get videoPlaying(): boolean {
    return this.isVideoPlaying;
  }

  public setVideoPlaying(value: boolean) {
    this.isVideoPlaying = value;
    if (value === true && this.videoDelayedPlayHandler) {
      this.videoDelayedPlayHandler();
    }
  }

  private async registerPlay() {
    while (this.videoTag.currentTime === 0) {
      // eslint-disable-next-line no-await-in-loop, no-promise-executor-return
      await new Promise((r) => setTimeout(r, 10));
    }
    this.setVideoPlaying(true);
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
      this.setVideoPlaying(false);
      console.warn("video paused.", this.userName);
    };

    video.onended = () => {
      this.setVideoPlaying(false);
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
      // If the update was called with no valid video track,
      // we take that as the camera being disabled. If the user
      // is in a focus zone or broadcasting, update their
      // focus tiles accordingly.
      this.cameraDisabled = true;
      if (this.currentAction === Action.InZone) {
        this.showOrUpdateCamera();
        return;
      }
      if (this.currentAction === Action.Broadcasting) {
        this.showOrUpdateBroadcast();
      }
      return;
    }
    // If there is a valid video track, we know the camera
    // is not disabled.
    this.cameraDisabled = false;
    // Only replace the track if the track ID has changed.
    if (newTrack.id !== this.videoTrack?.id) {
      this.videoTrack = newTrack;
      this.videoTag.srcObject = new MediaStream([newTrack]);
    }

    // If the user is in a focus zone or broadcasting,
    // update their focus tiles accordingly.
    if (this.currentAction === Action.InZone) {
      this.showOrUpdateCamera();
      return;
    }
    if (this.currentAction === Action.Broadcasting) {
      this.showOrUpdateBroadcast();
    }
  }

  updateScreenSource(newTrack: MediaStreamTrack) {
    const hadTrack = Boolean(this.screenTrack);
    this.screenTrack = newTrack;

    // If this user is traversing, don't show their screen track
    if (this.currentAction === Action.Traversing) return;

    // Otherwise, if the user has a new track and is not traversing,
    // try to show the screen track
    if (this.screenTrack) {
      this.tryShowScreenShare();
      return;
    }
    // If we had a track previously and no longer do,
    // try to remove any existing screen share DOM elements
    if (hadTrack) {
      this.tryRemoveScreenShare();
    }
  }

  updateAudioSource(newTrack: MediaStreamTrack) {
    if (!this.audioTag || !newTrack) return;

    if (newTrack.id === this.audioTrack?.id) {
      return;
    }

    this.audioTrack = newTrack;

    // The track has changed, so reset the nodes.

    // Save current gain and pan values, if any.
    const gain = this.nodeChain?.getGain();
    const pan = this.nodeChain?.getPan();

    // Destroy the current node chain.
    this.nodeChain.destroy();

    // Recreate audio nodes with previous gain and pan.
    if (gain && pan) {
      this.createAudioNodes(gain, pan);
    }

    if (this.currentAction === Action.InZone) {
      this.showOrUpdateCamera();
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
    this.showOrUpdateCamera();
    this.tryShowScreenShare();
  }

  leaveZone() {
    this.currentAction = Action.Traversing;
    removeCamera(this.id);
    this.tryRemoveScreenShare();
  }

  enterBroadcast() {
    if (this.audioTag) this.muteAudio();
    this.currentAction = Action.Broadcasting;
    this.showOrUpdateBroadcast();
    this.tryShowScreenShare();
  }

  leaveBroadcast() {
    this.currentAction = Action.Traversing;
    stopBroadcast();
    this.tryRemoveScreenShare();
  }

  updateAudio(gainValue: number, panValue: number) {
    if (!this.audioTag || !this.audioTrack) return;

    if (!this.nodeChain.initialized) {
      this.createAudioNodes(gainValue, panValue);
    }

    this.nodeChain.updateGain(gainValue);
    this.nodeChain.updatePan(panValue);
  }

  destroy() {
    console.log("destroying media", this.id);
    this.nodeChain.destroy();
    this.audioTag?.remove();
    this.videoTag.oncanplay = null;
    this.videoTag.onresize = null;
    this.videoTag.onplaying = null;
    this.videoTag.onended = null;
    this.videoTag.onpause = null;
    this.videoTag.remove();
  }

  private async createAudioNodes(gainValue: number, panValue: number) {
    const stream = await this.nodeChain.init(this.audioTrack);
    this.nodeChain.updateGain(gainValue);
    this.nodeChain.updatePan(panValue);

    this.audioTag.muted = false;
    this.audioTag.srcObject = stream;
    this.audioTag.play();
  }

  showOrUpdateCamera() {
    let videoTrack = null;
    if (this.videoTrack && !this.cameraDisabled) {
      videoTrack = this.videoTrack;
    }
    showCamera(this.id, this.userName, videoTrack, this.audioTrack);
  }

  showOrUpdateBroadcast() {
    let videoTrack = null;
    if (this.videoTrack && !this.cameraDisabled) {
      videoTrack = this.videoTrack;
    }
    showBroadcast(this.userName, videoTrack, this.audioTrack);
  }

  tryShowScreenShare() {
    if (!this.screenTrack) return;

    showScreenShare(this.id, this.userName, this.screenTrack);
    // Someone in a relevant zone started screen sharing that is NOT the local user,
    // disable the screen share button for the local user
    if (this.toggleScreenControls && this.currentAction === Action.InZone) {
      enableScreenBtn(false);
    }
  }

  tryRemoveScreenShare() {
    removeScreenShare(this.id);
    // Someone in a relevant zone stopped screen sharing that is NOT the local user,
    // so enable the screen share button for the local user.
    if (this.toggleScreenControls && this.currentAction === Action.InZone) {
      enableScreenBtn(true);
    }
  }
}
