const baseAlpha = 0.2;
const earshot = 150;
const maxAlpha = 1;
const baseWidth = 100;
const baseHeight = 100;

export class User extends PIXI.Sprite {
  videoTag = null;
  isInEarshot = false;

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
    this.onEnterEarshot = onEnterEarshot;
    this.onLeaveEarshot = onLeaveEarshot;
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
    this.height = baseHeight;
    this.width = baseWidth;
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

  updateTracks(videoTrack = null, audioTrack = null) {
    if (!audioTrack && !videoTrack) {
      if (this.videoTag.srcObject != null) {
        this.videoTag.srcObject = null;
        this.setDefaultTexture();
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
    if (videoTrack) {
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

      if (this.inEarshot(distance)) {
        // If we just entered earshot, trigger onEnterEarshot
        if (!other.isInEarshot) {
          other.isInEarshot = true;
          console.log("entered earshot", distance);
          if (this.onEnterEarshot) {
            this.onEnterEarshot(other.id);
          }
        }
        return;
      }
      // If we just left earshot, trigger onLeaveEarshot
      if (other.isInEarshot) {
        console.log("left earsrhot", distance);
        other.isInEarshot = false;
        if (this.onLeaveEarshot) {
          this.onLeaveEarshot(other.id);
        }
      }
    }
  }

  distanceTo(other) {
    // We need to get distance from the center of the avatar
    const thisX = Math.round(this.x + baseWidth / 2);
    const thisY = Math.round(this.y + baseHeight / 2);

    const otherX = Math.round(other.x + baseWidth / 2);
    const otherY = Math.round(other.y + baseHeight / 2);
    const dist = Math.hypot(otherX - thisX, otherY - thisY);
    // Round to nearest multiple of 5
    return Math.ceil(dist / 5) * 5;
  }

  inEarshot(distance) {
    return distance < this.earshot;
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
