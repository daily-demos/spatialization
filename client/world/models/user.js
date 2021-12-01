import { lerp } from "../util/lerp.js";

const baseAlpha = 0.2;
const earshot = 150;
const maxAlpha = 1;

export class User extends PIXI.Sprite {
  videoTag = null;
  constructor(name, params, isLocal = false, onEnterEarshot = null) {
    super();

    // How close another user needs to be to be seen/heard
    // by this user
    this.earshot = earshot;
    this.onEnterEarshot = onEnterEarshot;
    this.texture = createGradientTexture();
    if (isLocal) {
      this.alpha = maxAlpha;
    } else {
      this.alpha = baseAlpha;
    }
    this.name = name;
    this.id = params.userID;
    this.x = params.x;
    this.y = params.y;
    this.height = 150;
    this.width = 150;

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

  updateTracks(videoTrack = null, audioTrack = null) {
    console.log("UPDATING tracks", this.id, videoTrack, audioTrack);
    if (!audioTrack && !videoTrack) {
      if (this.videoTag.srcObject != null) {
        this.videoTag.srcObject = null;
        this.texture = createGradientTexture();
      }
      return;
    }
    const tracks = [];
    let textureMask = null;
    if (audioTrack) tracks.push(audioTrack);
    if (videoTrack) {
      tracks.push(videoTrack);
      const settings = videoTrack.getSettings();
      console.log("aspect ratio", settings);
      textureMask = new PIXI.Rectangle(settings.height / 2, 0, settings.height, settings.height);
    }
    let stream = new MediaStream(tracks);
    this.videoTag.srcObject = stream;
    let texture = PIXI.Texture.from(this.videoTag);
    //texture.frame  = new PIXI.Rectangle(0, 0, this.width, this.height);
    if (textureMask) {
      texture = new PIXI.Texture(texture, textureMask)
    }
    this.texture = texture;

  }

  getId() {
    return this.id;
  }

  getPos() {
    return {x: this.x, y: this.y}
  }

  getSprite() {
    return this.sprite;
  }

  moveTo (posX, posY) {
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

      if (this.inEarshot(distance)) {
        if (other.alpha !== 1) {
          other.alpha = 1;
        }
        if (this.onEnterEarshot) {
          this.onEnterEarshot(other.id);
        }
      }
      
    }
  }
  
  distanceTo(other) {
    // We need to get distance from the center of the avatar
    const thisX = this.x + this.width / 2;
    const thisY = this.y + this.height / 2;

    const otherX = other.x + other.width / 2;
    const otherY = other.y + other.height / 2;

    return Math.hypot(otherX-thisX, otherY-thisY);
  }

  inEarshot(distance) {
    return (distance < this.earshot);
  }

  
}

// https://pixijs.io/examples/#/textures/gradient-basic.js
function createGradientTexture() {
    const quality = 256;
    const canvas = document.createElement('canvas');
    canvas.width = quality;
    canvas.height = 1;

    const ctx = canvas.getContext('2d');

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

