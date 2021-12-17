import { Collider } from "./collider";
import * as PIXI from "pixi.js";
import { DisplayObject } from "pixi.js";

const baseAlpha = 0.2;
const earshot = 150;
const maxAlpha = 1;
const baseSize = 50;

enum TextureType {
  Unknown = 1,
  Default,
  Video,
}

export class User extends Collider {
  videoTag: HTMLVideoElement = null;
  audioTag: HTMLAudioElement = null;

  videoTrack: MediaStreamTrack;

  isInVicinity = false;
  textureType = TextureType.Unknown;
  zoneID = 0;

  earshotDistance: number;
  onEnterVicinity: Function;
  onLeaveEarshot: Function;
  isLocal: boolean;

  name: string;
  id: string;

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

    // How close another user needs to be to be seen/heard
    // by this user
    this.earshotDistance = earshot;
    this.onEnterVicinity = onEnterVicinity;
    this.onLeaveEarshot = onLeaveVicinity;
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

  setVideoTexture(videoTrack: MediaStreamTrack) {
    const settings = videoTrack.getSettings();
    const textureMask = new PIXI.Rectangle(
      settings.height / 2,
      0,
      settings.height,
      settings.height
    );
    let texture = new PIXI.BaseTexture(this.videoTag);
    this.texture = new PIXI.Texture(texture, textureMask);
    this.textureType = TextureType.Video;
  }

  setDefaultTexture() {
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
    if (this.isLocal) {
      this.setVideoTexture(this.videoTrack);
    }
  }

  streamVideo(newTrack: MediaStreamTrack) {
    if (newTrack === null) {
      this.videoTrack = newTrack;
      this.videoTag.srcObject = null;
      return;
    }
    if (newTrack.id === this.getVideoTrackID()) {
      return;
    }
    this.videoTrack = newTrack;
    let stream = new MediaStream([newTrack]);
    this.videoTag.srcObject = stream;
  }

  streamAudio(newTrack: MediaStreamTrack) {
    if (!this.audioTag) return;

    if (newTrack === null) {
      this.audioTag.srcObject = null;
      return;
    }
    if (newTrack.id === this.getAudioTrackID()) {
      return;
    }
    let stream = new MediaStream([newTrack]);
    this.audioTag.srcObject = stream;
  }

  getVideoTrackID() {
    const src = <MediaStream>this.videoTag?.srcObject;
    if (!src) return;
    const tracks = src.getVideoTracks();
    if (!tracks || tracks.length === 0) return -1;
    return tracks[0].id;
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
  }

  moveX(x: number) {
    this.x += x;
  }

  moveY(y: number) {
    this.y += y;
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
    const vicinity = this.earshotDistance * 2;
    const distance = this.distanceTo(other);

    other.alpha = (this.earshotDistance + vicinity - distance) / vicinity;

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
      console.log("left vicinity", distance);
      other.isInVicinity = false;
      if (this.onLeaveEarshot) {
        this.onLeaveEarshot(other.id);
      }
    }

    // Do earshot checks
    if (this.inEarshot(distance)) {
      if (!other.isInEarshot) {
        other.isInEarshot = true;
        console.log("entered earshot", other.name, other.videoTrack);
      }
      if (other.videoTrack && other.textureType != TextureType.Video) {
        other.setVideoTexture(other.videoTrack);
      }
    } else if (other.isInEarshot) {
      console.log("left earshot");
      other.isInEarshot = false;
      other.setDefaultTexture();
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
