import { Collider } from "./collider.js";

const baseAlpha = 0.2;
const earshot = 150;
const maxAlpha = 1;
const baseSize = 50;

export class User extends Collider {
  videoTag = null;
  isInVicinity = false;

  constructor(
    name,
    params,
    isLocal = false,
    onEnterEarshot = null,
    onLeaveEarshot = null
  ) {
    super();

    // How close another user needs to be to be seen/heard
    // by this user
    this.earshot = earshot;
    this.onEnterVicinity = onEnterEarshot;
    this.onLeaveEarshot = onLeaveEarshot;
    this.isLocal = isLocal;
    this.setDefaultTexture();
    if (isLocal) {
      this.alpha = maxAlpha;
    } else {
      this.alpha = baseAlpha;
    }
    this.name = name;
    this.id = params.userID;
    this.x = params.x;
    this.y = params.y;
    this.height = baseSize;
    this.width = baseSize;
    this.createVideoTag(isLocal);
  }

  createVideoTag(isLocal) {
    // Set up video tag
    const video = document.createElement("video");
    video.autoplay = true;
    video.classList.add("fit");
    video.classList.add("invisible");
    document.documentElement.appendChild(video);
    if (isLocal) {
      video.muted = true;
    }
    this.videoTag = video;
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
  }

  setDefaultTexture() {
    const texture = createGradientTexture();
    this.texture = new PIXI.Texture(texture);
  }

  // updateTracks sets the tracks, but does not
  // necessarily update the texture until we are in
  // earshot
  updateTracks(videoTrack = null, audioTrack = null) {
    this.videoTrack = videoTrack;
    this.audioTrack = audioTrack;
    if (!audioTrack && !videoTrack) {
      if (this.videoTag.srcObject != null) {
        this.videoTag.srcObject = null;
      }
      return;
    }
    const tracks = [];
    if (audioTrack) tracks.push(audioTrack);
    if (videoTrack) {
      tracks.push(videoTrack);
    }
    let stream = new MediaStream(tracks);
    this.videoTag.srcObject = stream;
    if (this.isLocal) {
      this.setVideoTexture(videoTrack);
    }
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
      if (other.id === this.id) {
        continue;
      }
      const vicinity = this.earshot * 2;
      const distance = this.distanceTo(other);

      other.alpha = (this.earshot + vicinity - distance) / vicinity;

      // Do vicinity checks
      if (this.inVicinity(distance)) {
        // If we just entered earshot, trigger onEnterEarshot
        if (!other.isInVicinity) {
          other.isInVicinity = true;
          console.log("entered vicinity", distance);
          if (this.onEnterVicinity) {
            this.onEnterVicinity(other.id);
          }
        }
      } else if (other.isInVicinity) {
        console.log("left earsrhot", distance);
        other.isInVicinity = false;
        if (this.onLeaveEarshot) {
          this.onLeaveEarshot(other.id);
        }
      }

      // Do earshot checks
      if (this.inEarshot(distance)) {
        if (!other.inEarshot) {
          other.inEarshot = true;
          if (other.videoTrack) {
            other.setVideoTexture(other.videoTrack);
          }
        }
      } else if (other.inEarshot) {
        other.inEarshot = false;
        other.setDefaultTexture();
      }
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
  const quality = 256;
  const canvas = document.createElement("canvas");
  canvas.width = quality;
  canvas.height = 1;

  const ctx = canvas.getContext("2d");

  // use canvas2d API to create gradient
  const grd = ctx.createLinearGradient(0, 0, quality, 0);

  grd.addColorStop(0, generateColor());
  grd.addColorStop(0.3, generateColor());
  grd.addColorStop(0.7, generateColor());
  grd.addColorStop(1, generateColor());

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, quality, 1);

  return PIXI.Texture.from(canvas);
}

function generateColor() {
  return `#${Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, "0")}`;
}
