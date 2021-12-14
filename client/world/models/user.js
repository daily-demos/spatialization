import { Collider } from "./collider.js";

const baseAlpha = 0.2;
const earshot = 150;
const maxAlpha = 1;
const baseSize = 50;

const TEXTURE_UNKNOWN = Symbol(0);
const TEXTURE_DEFAULT = Symbol(1);
const TEXTURE_VIDEO = Symbol(2);

export class User extends Collider {
  videoTag = null;
  audioTag = null;
  isInVicinity = false;
  textureType = TEXTURE_UNKNOWN;

  constructor(
    name,
    params,
    isLocal = false,
    onEnterVicinity = null,
    onLeaveVicinity = null
  ) {
    super();

    // How close another user needs to be to be seen/heard
    // by this user
    this.earshot = earshot;
    this.onEnterVicinity = onEnterVicinity;
    this.onLeaveEarshot = onLeaveVicinity;
    this.isLocal = isLocal;
    this.setDefaultTexture();
    this.name = name;
    this.id = params.userID;
    this.x = params.x;
    this.y = params.y;
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

  setVideoTexture(videoTrack) {
    const settings = videoTrack.getSettings();
    const textureMask = new PIXI.Rectangle(
      settings.height / 2,
      0,
      settings.height,
      settings.height
    );
    let texture = new PIXI.BaseTexture(this.videoTag);
    this.texture = new PIXI.Texture(texture, textureMask);
    this.textureType = TEXTURE_VIDEO;
  }

  setDefaultTexture() {
    const texture = createGradientTexture();
    this.texture = new PIXI.Texture(texture);
    this.textureType = TEXTURE_DEFAULT;
  }

  // updateTracks sets the tracks, but does not
  // necessarily update the texture until we are in
  // earshot
  updateTracks(videoTrack = null, audioTrack = null) {
    this.streamVideo(videoTrack);
    this.streamAudio(audioTrack);
    if (this.isLocal) {
      this.setVideoTexture(this.videoTrack);
    }
  }

  streamVideo(newTrack) {
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

  streamAudio(newTrack) {
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
    const tracks = this.videoTag?.srcObject?.getVideoTracks();
    if (!tracks || tracks.length === 0) return -1;
    return tracks[0].id;
  }

  getAudioTrackID() {
    const tracks = this.audioTag?.srcObject?.getAudioTracks();
    if (!tracks || tracks.length === 0) return -1;
    return tracks[0].id;
  }

  getId() {
    return this.id;
  }

  getPos() {
    return { x: this.x, y: this.y };
  }

  getSprite() {
    return this.sprite;
  }

  moveTo(posX, posY) {
    this.x = posX;
    this.y = posY;
  }

  moveX(x) {
    this.x += x;
  }

  moveY(y) {
    this.y += y;
  }

  checkProximity(others) {
    for (let other of others) {
      this.proximityUpdate(other);
    }
  }

  async proximityUpdate(other) {
    if (other.id === this.id) {
      return;
    }
    const vicinity = this.earshot * 2;
    const distance = this.distanceTo(other);

    other.alpha = (this.earshot + vicinity - distance) / vicinity;

    // Do vicinity checks
    if (this.inVicinity(distance)) {
      // If we just entered vicinity, trigger onEntericinity
      if (!other.isInVicinity) {
        other.isInVicinity = true;
        console.log("entered vicinity", distance, this.onEnterVicinity);
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
      if (!other.inEarshot) {
        other.inEarshot = true;
        console.log("entered earshot", other.name, other.videoTrack)
      }
      if (other.videoTrack && !other.textureType != TEXTURE_VIDEO) {
        other.setVideoTexture(other.videoTrack);
      }
    } else if (other.inEarshot) {
      console.log("left earshot")
      other.inEarshot = false;
      other.setDefaultTexture();
    }
  }

  distanceTo(other) {
    // We need to get distance from the center of the avatar
    const thisX = Math.round(this.x + baseSize / 2);
    const thisY = Math.round(this.y + baseSize / 2);

    const otherX = Math.round(other.x + baseSize / 2);
    const otherY = Math.round(other.y + baseSize / 2);
    const dist = Math.hypot(otherX - thisX, otherY - thisY);
    // Round to nearest multiple of 5
    return Math.ceil(dist / 5) * 5;
  }

  inEarshot(distance) {
    return distance < this.earshot;
  }

  inVicinity(distance) {
    return distance < this.earshot * 2;
  }
}

// https://pixijs.io/examples/#/textures/gradient-basic.js
function createGradientTexture() {
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

function generateColor() {
  return `#${Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, "0")}`;
}
