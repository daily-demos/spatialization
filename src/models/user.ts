import { Collider } from "./collider";
import * as PIXI from "pixi.js";
import { DisplayObject, TilingSprite } from "pixi.js";

const baseAlpha = 0.2;
const earshot = 300;
const maxAlpha = 1;
const baseSize = 50;
const defaultSpeed = 3;

let audioCtx: AudioContext;
const posZ = 300;

enum TextureType {
  Unknown = 1,
  Default,
  Video,
}

export class User extends Collider {
  videoTag: HTMLVideoElement = null;
  audioTag: HTMLAudioElement = null;

  videoTrack: MediaStreamTrack;
  audioTrack: MediaStreamTrack;

  pannerNode: PannerNode;
  stereoPannerNode: StereoPannerNode;
  outputAudio: HTMLAudioElement;

  isInVicinity = false;
  textureType = TextureType.Unknown;
  zoneID = 0;

  earshotDistance: number;
  onEnterVicinity: Function;
  onLeaveVicinity: Function;
  isLocal: boolean;

  name: string;
  id: string;

  speed: number;

  isInEarshot: boolean;
  lastMoveAt: number;

  constructor(
    name: string,
    userID: string,
    x: number,
    y: number,
    isLocal = false,
    onEnterVicinity: Function = null,
    onLeaveVicinity: Function = null
  ) {
    super();

    if (isLocal) {
      audioCtx = new AudioContext();
    }

    this.speed = defaultSpeed;
    // How close another user needs to be to be seen/heard
    // by this user
    this.earshotDistance = earshot;
    this.onEnterVicinity = onEnterVicinity;
    this.onLeaveVicinity = onLeaveVicinity;
    this.isLocal = isLocal;
    this.setDefaultTexture();
    this.name = name;
    this.id = userID;
    this.x = x;
    this.y = y;
    this.height = baseSize;
    this.width = baseSize;
    this.createVideoTag();
    if (!isLocal) {
      this.alpha = baseAlpha;
      this.createAudioTag();
    } else {
      this.alpha = maxAlpha;
      this.updateListener();
    }
  }

  createVideoTag() {
    // Set up video tag
    const video = document.createElement("video");
    video.autoplay = true;
    video.classList.add("fit");
    video.classList.add("invisible");
    document.documentElement.appendChild(video);
    this.videoTag = video;
  }

  createAudioTag() {
    // Set up audio tag
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.classList.add("invisible");
    document.documentElement.appendChild(audio);
    this.audioTag = audio;
  }

  setVideoTexture() {
    console.log("setting video texture", this.id);
    const videoTrack = this.getVideoTrack();
    if (!videoTrack) return;

    const settings = videoTrack.getSettings();
    if (!settings.height) {
      return;
    }

    let texture = new PIXI.BaseTexture(this.videoTag);

    const textureMask = new PIXI.Rectangle(
      settings.height / 2,
      0,
      settings.height,
      settings.height
    );

    this.texture = new PIXI.Texture(texture, textureMask);

    this.textureType = TextureType.Video;
  }

  setDefaultTexture() {
    console.log("setting default texture");
    const texture = createGradientTexture();
    this.texture = texture;
    this.textureType = TextureType.Default;
  }

  // updateTracks sets the tracks, but does not
  // necessarily update the texture until we are in
  // earshot
  updateTracks(
    videoTrack: MediaStreamTrack = null,
    audioTrack: MediaStreamTrack = null
  ) {
    this.streamVideo(videoTrack);
    this.streamAudio(audioTrack);
  }

  streamVideo(newTrack: MediaStreamTrack) {
    console.log("streamVideo", this.id, newTrack);
    if (!newTrack) {
      if (this.textureType === TextureType.Video) {
        this.setDefaultTexture();
      }
      this.videoTag.srcObject = null;
      return;
    }
    if (newTrack.id === this.getVideoTrackID()) {
      console.log("IDs are identical", this.id);
      return;
    }

    let stream = new MediaStream([newTrack]);
    this.videoTag.srcObject = stream;

    if (this.isLocal) {
      this.setVideoTexture();
    }
  }

  streamAudio(newTrack: MediaStreamTrack) {
    if (!this.audioTag) return;

    if (!newTrack) {
      this.audioTrack = null;
      return;
    }
    if (newTrack.id === this.getAudioTrackID()) {
      return;
    }
    this.audioTrack = newTrack;
    this.pannerNode = null;
    // let stream = new MediaStream([newTrack]);
    // this.audioTag.srcObject = stream;
  }

  getVideoTrackID(): string {
    const track = this.getVideoTrack();
    if (!track) return "-1";
    return track.id;
  }

  getVideoTrack(): MediaStreamTrack {
    const src = <MediaStream>this.videoTag?.srcObject;
    if (!src) return null;
    const tracks = src.getVideoTracks();
    if (!tracks || tracks.length === 0) return null;
    return tracks[0];
  }

  getAudioTrackID() {
    const src = <MediaStream>this.audioTag?.srcObject;
    if (!src) return;
    const tracks = src.getAudioTracks();
    if (!tracks || tracks.length === 0) return -1;
    return tracks[0].id;
  }

  getId() {
    return this.id;
  }

  getPos() {
    return { x: this.x, y: this.y };
  }

  moveTo(posX: number, posY: number) {
    this.x = posX;
    this.y = posY;
    this.updateListener();
  }

  moveX(x: number) {
    this.x += x;
    this.updateListener();
  }

  moveY(y: number) {
    this.y += y;
    this.updateListener();
  }

  initListener() {
    if (!this.isLocal) return;
    const listener = audioCtx.listener;
    listener.positionX.value = this.x;
    listener.positionY.value = this.y;
    listener.positionZ.value = posZ - 5;
    listener.forwardX.value = 0;
    listener.forwardY.value = 0;
    listener.forwardZ.value = -1;
    listener.upX.value = 0;
    listener.upY.value = 1;
    listener.upZ.value = 0;
  }

  updateListener() {
    if (!this.isLocal) return;
    const listener = audioCtx.listener;
    listener.positionX.value = this.x;
    listener.positionY.value = this.y;
  }

  updatePanner(pos: Pos, panValue: number) {
    if (this.isLocal || !this.audioTrack) return;

    const globalPos = this.toGlobal(new PIXI.Point(0, 0));

    if (!this.pannerNode) {
      let gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(1, audioCtx.currentTime);

      const stream = new MediaStream([this.audioTrack]);

      this.pannerNode = new PannerNode(audioCtx, {
        panningModel: "HRTF",
        distanceModel: "linear",
        positionX: pos.x,
        positionY: pos.y,
        positionZ: posZ,
        orientationX: 0.0,
        orientationY: 0.0,
        orientationZ: -1.0,
        refDistance: 1,
        maxDistance: 1000,
        rolloffFactor: 1,
        coneInnerAngle: 60,
        coneOuterAngle: 90,
        coneOuterGain: 0.3,
      });

      this.stereoPannerNode = new StereoPannerNode(audioCtx);

      // Get pan value
      this.stereoPannerNode.pan.value = panValue;

      // Apparently this is required due to a Chromium bug!
      // https://bugs.chromium.org/p/chromium/issues/detail?id=687574
      // https://stackoverflow.com/questions/55703316/audio-from-rtcpeerconnection-is-not-audible-after-processing-in-audiocontext
      const mutedAudio = new Audio();
      this.outputAudio = new Audio();

      mutedAudio.muted = true;
      mutedAudio.srcObject = stream;
      mutedAudio.play();

      const source = audioCtx.createMediaStreamSource(stream);
      const destination = audioCtx.createMediaStreamDestination();

      source.connect(this.pannerNode);
      this.pannerNode.connect(this.stereoPannerNode);
      this.stereoPannerNode.connect(destination);
      this.outputAudio.muted = false;
      this.outputAudio.srcObject = destination.stream;
      this.outputAudio.play();
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

  checkProximity(others: Array<DisplayObject>) {
    for (let other of others) {
      const o = <User>other;
      this.proximityUpdate(o);
    }
  }

  async proximityUpdate(other: User) {
    if (other.id === this.id) {
      return;
    }

    const distance = this.distanceTo(other);

    const desiredPannerDistance = (distance * 1000) / this.earshotDistance;
    const op = other.getPos();

    const dx = op.x - this.x;
    const dy = op.y - this.y;

    const part = desiredPannerDistance / distance;
    var pannerPos = {
      x: Math.round(op.x + dx * part),
      y: Math.round(op.y + dy * part),
    };

    // pan value (-1, 1)
    // https://developer.mozilla.org/en-US/docs/Web/API/StereoPannerNode/pan
    const panValue = (1 * dx) / this.earshotDistance;
    other.updatePanner(pannerPos, panValue);

    other.alpha =
      (this.earshotDistance * 1.5 - distance) / this.earshotDistance;

    // Do vicinity checks
    if (this.inVicinity(distance)) {
      // If we just entered vicinity, trigger onEntericinity
      if (!other.isInVicinity) {
        other.isInVicinity = true;
        console.log("entered vicinity", distance);
        if (this.onEnterVicinity) {
          this.onEnterVicinity(other.id);
        }
      }
    } else if (other.isInVicinity) {
      console.log("left vicinity", distance, other.pannerNode);
      other.isInVicinity = false;
      if (this.onLeaveVicinity) {
        this.onLeaveVicinity(other.id);
      }
    }

    // Do earshot checks
    if (this.inEarshot(distance)) {
      if (!other.isInEarshot) {
        other.isInEarshot = true;
        if (other.outputAudio) other.outputAudio.muted = false;
        console.log("entered earshot", other.name);
      }
      const otherTrack = other.getVideoTrack();
      if (otherTrack != null && other.textureType != TextureType.Video) {
        other.setVideoTexture();
      }
    } else if (other.isInEarshot) {
      console.log("left earshot", other.pannerNode);
      other.isInEarshot = false;
      other.setDefaultTexture();
      if (other.outputAudio) other.outputAudio.muted = true;
    }
  }

  distanceTo(other: User) {
    // We need to get distance from the center of the avatar
    const thisX = Math.round(this.x + baseSize / 2);
    const thisY = Math.round(this.y + baseSize / 2);

    const otherX = Math.round(other.x + baseSize / 2);
    const otherY = Math.round(other.y + baseSize / 2);
    const dist = Math.hypot(otherX - thisX, otherY - thisY);
    // Round to nearest multiple of 5
    return Math.ceil(dist / 5) * 5;
  }

  inEarshot(distance: number) {
    return distance < this.earshotDistance;
  }

  inVicinity(distance: number) {
    return distance < this.earshotDistance * 2;
  }
}

// https://pixijs.io/examples/#/textures/gradient-basic.js
function createGradientTexture(): PIXI.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = baseSize;
  canvas.height = 1;

  const ctx = canvas.getContext("2d");

  // use canvas2d API to create gradient
  const grd = ctx.createLinearGradient(150, 0, baseSize, 50);
  grd.addColorStop(0, "#121a24");
  grd.addColorStop(1, "#2b3f56");

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, baseSize, 1);

  return PIXI.Texture.from(canvas);
}
