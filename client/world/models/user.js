import { lerp } from "../util/lerp.js";

const baseAlpha = 0.2;
const earshot = 150;
const maxAlpha = 1;

export class User extends PIXI.Sprite {
  audioTrack = null;
  videoTrack = null;
  screenTrack = null;
  constructor(name, params, isLocal = false, onEnterEarshot = null) {
    super();

    // How close another user needs to be to be seen
    // by this user.
    this.earshot = earshot;
    this.onEnterEarshot = onEnterEarshot;
    this.setTexture = this.setTexture(createGradientTexture());
    if (isLocal) {
      this.alpha = maxAlpha;
    } else {
      this.alpha = baseAlpha;
    }
    this.name = name;
    this.id = params.userID;
    this.x = params.x;
    this.y = params.y;
    this.height = 50;
    this.width = 50;
  }

  updateTracks(audio = null, video = null, screen = null) {
    if (!this.videoTrack && video) {
      // Video was not on before, but now it is.

    }
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

