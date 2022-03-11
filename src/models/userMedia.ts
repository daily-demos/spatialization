import {
  AudioContext,
  IMediaStreamAudioDestinationNode,
  IGainNode,
  IStereoPannerNode,
  IDynamicsCompressorNode,
  IMediaStreamAudioSourceNode,
} from "standardized-audio-context";
import { standardTileSize } from "../config";
import { Loopback } from "../util/loopback";
import { enableScreenBtn } from "../util/nav";
import {
  removeScreenShare,
  removeCamera,
  showBroadcast,
  showScreenShare,
  showCamera,
  stopBroadcast,
} from "../util/tile";

export const maxPannerDistance = 1000;

export enum Action {
  Traversing,
  InZone,
  Broadcasting,
}

const isChrome: boolean = !!(navigator.userAgent.indexOf("Chrome") !== -1);

// NodeChain is responsible for creating, destroying, and connecting our
// Web Audio API nodes.
class NodeChain {
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
        window.audioContext.currentTime
      );
    } catch (e) {
      console.error(`failed to update pan: ${e} (pan value: ${val})`);
    }
  }

  async init(track: MediaStreamTrack): Promise<MediaStream> {
    const stream = new MediaStream([track]);

    this.mutedAudio.srcObject = stream;
    this.mutedAudio.play();

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

    // This is a workaround for there being no noise cancellation
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

// UserMedia holds all audio and video related tags,
// streams, and panners for a user.
export class UserMedia {
  videoTag: HTMLVideoElement;
  audioTag: HTMLAudioElement;
  cameraDisabled: boolean;
  currentAction: Action = Action.Traversing;
  userName: string;
  toggleScreenControls: boolean;
  videoDelayedPlayHandler: () => void;

  private videoTrack: MediaStreamTrack;
  private audioTrack: MediaStreamTrack;
  private screenTrack: MediaStreamTrack;
  private _videoPlaying = false;
  private nodeChain = new NodeChain();
  private id: string;

  constructor(id: string, userName: string, isLocal: boolean) {
    this.id = id;
    if (!userName) {
      userName = id;
    }
    this.userName = userName;
    this.createVideoTag();
    if (!isLocal) {
      this.createAudioTag();
      this.toggleScreenControls = true;
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
