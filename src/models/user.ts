import { Collider } from "./collider";
import * as PIXI from "pixi.js";
import { DisplayObject } from "pixi.js";
import { BroadcastSpot } from "./broadcast";
import { Desk } from "./desk";
import { UserMedia } from "./userMedia";
import { removeZonemate, showZonemate } from "../util/nav";

const baseAlpha = 0.2;
const earshot = 300;
const maxAlpha = 1;
const baseSize = 50;
const defaultSpeed = 3;

const posZ = 300;

enum TextureType {
  Unknown = 1,
  Default,
  Video,
}

export class User extends Collider {
  isInVicinity = false;
  textureType = TextureType.Unknown;
  zoneID = 0;

  isBroadcasting: boolean;

  earshotDistance: number;
  onEnterVicinity: Function;
  onLeaveVicinity: Function;
  onJoinZone: (sessionID: string, zoneID: number, pos: Pos) => void;

  isLocal: boolean;

  name: string;
  id: string;

  speed: number;

  isInEarshot: boolean;
  lastMoveAt: number;

  media: UserMedia;

  constructor(
    name: string,
    userID: string,
    x: number,
    y: number,
    isLocal = false,
    onEnterVicinity: Function = null,
    onLeaveVicinity: Function = null,
    onJoinZone: (sessionID: string, zoneID: number, pos: Pos) => void = null
  ) {
    super();
    this.media = new UserMedia(userID, isLocal);

    this.speed = defaultSpeed;
    // How close another user needs to be to be seen/heard
    // by this user
    this.earshotDistance = earshot;
    this.onEnterVicinity = onEnterVicinity;
    this.onLeaveVicinity = onLeaveVicinity;
    this.onJoinZone = onJoinZone;
    this.isLocal = isLocal;
    this.setDefaultTexture();
    this.name = name;
    this.id = userID;
    this.x = x;
    this.y = y;
    this.height = baseSize;
    this.width = baseSize;
    if (!isLocal) {
      this.alpha = baseAlpha;
    } else {
      this.alpha = maxAlpha;
    }
  }

  private setVideoTexture() {
    const videoTrack = this.media.getVideoTrack();
    if (!videoTrack) return;

    const settings = videoTrack.getSettings();
    if (!settings.height) {
      return;
    }

    let texture = new PIXI.BaseTexture(this.media.videoTag);

    const textureMask = new PIXI.Rectangle(
      settings.height / 2,
      0,
      settings.height,
      settings.height
    );

    this.texture = new PIXI.Texture(texture, textureMask);

    this.textureType = TextureType.Video;
  }

  private setDefaultTexture() {
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
    if (!this.isLocal) {
      this.streamAudio(audioTrack);
    }
  }

  private streamVideo(newTrack: MediaStreamTrack) {
    if (!newTrack) {
      if (this.textureType === TextureType.Video) {
        this.setDefaultTexture();
      }
      return;
    }

    this.media.updateVideoSource(newTrack);

    if (this.isLocal) {
      this.setVideoTexture();
    }
  }

  private streamAudio(newTrack: MediaStreamTrack) {
    this.media.updateAudioSource(newTrack);
  }

  getPos() {
    return { x: this.x, y: this.y };
  }

  updateZone(zoneID: number) {
    const oldZoneID = this.zoneID;
    if (zoneID === oldZoneID) return;
    this.zoneID = zoneID;
    this.onJoinZone(this.id, this.zoneID, this.getPos());
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

  private updateListener() {
    if (!this.isLocal) return;
    const listener = window.audioContext.listener;
    listener.positionX.value = this.x;
    listener.positionY.value = this.y;
  }

  checkUserProximity(others: Array<DisplayObject>) {
    for (let other of others) {
      const o = <User>other;
      if (o.id === this.id) continue;

      if (o.isBroadcasting) {
        o.media.muteAudio();
        return;
      }
      if (o.zoneID > 0 && o.zoneID === this.zoneID) {
        if (!o.media.streamToZone) {
          if (!o.isInVicinity) {
            o.isInVicinity = true;
            this.onEnterVicinity(o.id);
          }
          o.media.streamToZone = true;
          o.media.showOrUpdateZonemate();
        }
      } else if (o.zoneID !== this.zoneID) {
        if (o.isInVicinity) {
          o.isInVicinity = false;
          this.onLeaveVicinity(o.id);
          o.setDefaultTexture();
        }
        if (o.media.streamToZone) {
          console.log("removing zonemate");
          o.media.streamToZone = false;
          removeZonemate(o.id);
        }

        // Mute the other user's default audio either way
        o.media.muteAudio();
        return;
      }

      this.proximityUpdate(o);
    }
  }

  checkFurniture(others: Array<DisplayObject>) {
    for (let other of others) {
      if (!this.isLocal) {
        if (other instanceof BroadcastSpot) {
          const o = <BroadcastSpot>other;
          if (o) o.tryInteract(this);
        }
      } else {
        if (other instanceof Desk) {
          const o = <Desk>other;
          if (o) o.tryInteract(this);
        }
      }
    }
  }

  private async proximityUpdate(other: User) {
    if (other.id === this.id) {
      return;
    }

    const distance = this.distanceTo(other);

    other.alpha =
      (this.earshotDistance * 1.5 - distance) / this.earshotDistance;

    // Do vicinity checks
    if (this.inVicinity(distance)) {
      // If we just entered vicinity, trigger onEntericinity
      if (!other.isInVicinity) {
        other.isInVicinity = true;
        if (this.onEnterVicinity) {
          this.onEnterVicinity(other.id);
        }
      }
    } else if (other.isInVicinity) {
      other.isInVicinity = false;
      if (this.onLeaveVicinity) {
        this.onLeaveVicinity(other.id);
      }
    }

    // Do earshot checks

    // User is in earshot
    if (this.inEarshot(distance)) {
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
      other.media.updatePanner(pannerPos, panValue);

      if (!other.isInEarshot) {
        other.isInEarshot = true;
        other.media.unmuteAudio();
      }
      const otherTrack = other.media.getVideoTrack();
      if (otherTrack != null && other.textureType != TextureType.Video) {
        other.setVideoTexture();
      }
      return;
    }

    // User is not currently in earshot, but was before
    if (other.isInEarshot) {
      other.isInEarshot = false;
      other.setDefaultTexture();
      other.media.muteAudio();
    }
  }

  private distanceTo(other: User) {
    // We need to get distance from the center of the avatar
    const thisX = Math.round(this.x + baseSize / 2);
    const thisY = Math.round(this.y + baseSize / 2);

    const otherX = Math.round(other.x + baseSize / 2);
    const otherY = Math.round(other.y + baseSize / 2);
    const dist = Math.hypot(otherX - thisX, otherY - thisY);
    // Round to nearest multiple of 5
    return Math.ceil(dist / 5) * 5;
  }

  private inEarshot(distance: number) {
    return distance < this.earshotDistance;
  }

  private inVicinity(distance: number) {
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
