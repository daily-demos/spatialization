import { lerp } from "../util/lerp.js";

const baseAlpha = 0.2;

export class User extends PIXI.Sprite {
  audioTrack = null;
  videoTrack = null;
  screenTrack = null;
  constructor(name, params, sight = 150, onSight = null) {
    super();

    // How close another user needs to be to be seen
    // by this user.
    this.sight = sight;
    this.onSight = onSight;
    this.setTexture = this.setTexture(createGradientTexture());
    this.alpha = baseAlpha;
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
    console.log("getting id", this.id);
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

  checkSight(others) {
    if (!this.onSight) {
      return;
    }

    const distance = this.distanceTo(other);
    for (let other of others) {
      if (this.canSee(other)) {
        other.alpha = lerp(0.2, 1, distance);
        this.onSight(other.id);
      }
    }
  }

  

  distanceTo(other) {
    return Math.hypot(other.x-this.x, other.y-this.y)
  }

  canSee(other) {
    const distance = distanceTo(other);
    return (distance < this.sight);
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

