import { Collider, ICollider } from "./collider";
import * as PIXI from "pixi.js";
import { DisplayObject } from "pixi.js";
import { BroadcastZone } from "./broadcastZone";
import { Action, maxPannerDistance, UserMedia } from "./userMedia";
import { removeZonemate } from "../util/nav";
import { Pos, Size, ZoneData } from "../worldTypes";
import { Textures } from "../textures";
import { DeskZone } from "./deskZone";
import { broadcastZoneID, globalZoneID } from "../config";

const baseAlpha = 0.2;
const earshot = 300;
const maxAlpha = 1;
const baseSize = 75;
const defaultSpeed = 4;
enum TextureType {
  Unknown = 1,
  Default,
  Video,
}

// User is a participant in the world (and the call)
export class User extends Collider {
  id: string;
  speed: number;
  isInVicinity = false;
  media: UserMedia;
  isLocal: boolean;

  protected emoji: string = "😊";
  protected gradientTextureName: string = "user-gradient";

  private textureType = TextureType.Unknown;
  private zoneData: ZoneData = { zoneID: 0, spotID: -1 };

  private earshotDistance: number;
  private onEnterVicinity: Function;
  private onLeaveVicinity: Function;
  private onJoinZone: (zoneData: ZoneData, recipient?: string) => void;
  private localZoneMates: Array<string> = [];
  private userName: string;

  constructor(
    id: string,
    x: number,
    y: number,
    isLocal = false,
    onEnterVicinity: Function = null,
    onLeaveVicinity: Function = null,
    onJoinZone: (zoneData: ZoneData, recipient?: string) => void = null
  ) {
    super();
    this.media = new UserMedia(id, isLocal);

    this.speed = defaultSpeed;
    // How close another user needs to be to be seen/heard
    // by this user
    this.earshotDistance = earshot;
    this.onEnterVicinity = onEnterVicinity;
    this.onLeaveVicinity = onLeaveVicinity;
    this.onJoinZone = onJoinZone;
    this.isLocal = isLocal;
    this.id = id;
    // This field is on the Pixi base class. It is
    // differen from the userName and MUST match
    // the unique ID.
    this.name = id;
    this.x = x;
    this.y = y;
    this.height = baseSize;
    this.width = baseSize;
    if (!isLocal) {
      this.alpha = baseAlpha;
    } else {
      this.alpha = maxAlpha;
    }

    this.setDefaultTexture();
  }

  setUserName(name: string) {
    this.userName = name;
  }

  destroy() {
    this.media.destroy();
  }

  private setVideoTexture() {
    const videoTrack = this.media.getVideoTrack();
    if (!videoTrack) return;

    const settings = videoTrack.getSettings();
    if (!settings.height) {
      return;
    }

    this.textureType = TextureType.Video;

    // I am not (yet) sure why this is needed, but without
    // it we get inconsistent bounds and broken collision
    // detection when switching textures.
    this.getBounds(true);
    let texture = new PIXI.BaseTexture(this.media.videoTag);
    texture.setSize(baseSize, baseSize);
    let textureMask: PIXI.Rectangle = null;
    textureMask = new PIXI.Rectangle(0, 0, baseSize, baseSize);

    this.texture = new PIXI.Texture(texture, textureMask);
    this.texture.updateUvs();
    this.width = baseSize;
    this.height = baseSize;
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

  getPos(): Pos {
    return { x: this.x, y: this.y };
  }

  getSize(): Size {
    return { width: this.width, height: this.height };
  }

  updateZone(zoneID: number, spotID: number = -1) {
    const oldZoneID = this.zoneData.zoneID;
    const oldSpotID = this.zoneData.spotID;
    if (zoneID === oldZoneID && spotID === oldSpotID) return;
    console.log("updating zone:", oldZoneID, zoneID);
    this.zoneData.zoneID = zoneID;
    this.zoneData.spotID = spotID;
    if (oldZoneID === broadcastZoneID) {
      this.media.leaveBroadcast();
    }
    if (this.isLocal) {
      this.localZoneMates = [];
      if (this.onJoinZone) this.onJoinZone({ zoneID: zoneID, spotID: spotID });

      if (zoneID === globalZoneID) {
        this.setVideoTexture();
        return;
      }
      this.setDefaultTexture();
      return;
    }
  }

  getZoneData(): ZoneData {
    return this.zoneData;
  }

  isZonemate(other: User) {
    return this.zoneData.zoneID === other.zoneData.zoneID;
  }

  getZonemates(): Array<string> {
    return this.localZoneMates;
  }

  moveTo(pos: Pos, trial = false) {
    this.x = Math.round(pos.x);
    this.y = Math.round(pos.y);
    this.getBounds();
    if (!trial) this.tryUpdateListener();
  }

  async processUsers(others: Array<DisplayObject>) {
    for (let other of others) {
      this.processUser(<User>other);
    }
  }

  // "Furniture" can be any non-user colliders in the world.
  // Eg: desks or broadcast spots
  checkFurnitures(others: Array<ICollider>) {
    for (let other of others) {
      this.checkFurniture(other);
    }
  }

  // Private methods below

  private tryUpdateListener() {
    if (!this.isLocal) return;

    const listener = window.audioContext.listener;
    // Note that this only works through our use of `standardized-audio-context`
    // With a vanilla AudioContext, this would need to conditionally use `setPosition()`
    // depending on the browser. `setPosition()` is deprecated, but is the only way to
    // update position in some browsers:
    // https://developer.mozilla.org/en-US/docs/Web/API/AudioListener
    listener.positionX.value = this.x;
    listener.positionY.value = this.y;
  }

  private async processUser(o: User) {
    // If this is the local user, skip
    if (o.id === this.id) return;

    // If the other user is broadcasting, mute their default tile audio
    // We don't want two audio sources for the same user.
    if (o.media.currentAction === Action.Broadcasting) {
      o.alpha = 1;
      return;
    }

    const tzID = this.zoneData.zoneID;
    const ozID = o.zoneData.zoneID;

    // Both users are in the default zone

    if (tzID === globalZoneID && ozID === globalZoneID) {
      this.proximityUpdate(o);
      return;
    }

    // If both users are not in the default zone, we already know we won't
    // be playing audio through the traversal tile. Mute it.
    o.media.muteAudio();

    // If the users are in the same zone that is not the default zone,
    // enter vicinity and display them as zonemates in focused-mode.
    if (ozID > 0 && ozID === tzID) {
      // Store this in the localZoneMates array for more efficient
      // broadcasting later.
      if (this.localZoneMates.indexOf(o.id) === -1) {
        this.localZoneMates.push(o.id);
      }

      if (o.media.currentAction !== Action.InZone) {
        if (!o.isInVicinity) {
          o.alpha = 1;
          o.isInVicinity = true;
          if (this.onEnterVicinity) this.onEnterVicinity(o.id);
        }
        o.media.currentAction = Action.InZone;
      }
      // Mute the other user's default audio, since we'll
      // be streaming via a zone.
      o.media.muteAudio();
      return;
    }

    // If the other user is broadcasting,
    // enter vicinity and display them in focused-mode
    if (ozID === broadcastZoneID) {
      console.log("Other is in BROADCAST ID", o.isInVicinity);
      if (!o.isInVicinity) {
        o.alpha = 1;
        o.isInVicinity = true;
        if (this.onEnterVicinity) this.onEnterVicinity(o.id);

        o.media.enterBroadcast();
      }
      return;
    }

    if (ozID !== tzID) {
      // If the other user is not in a default zone but the zone does
      // NOT match local user...
      o.alpha = baseAlpha;

      // Leave vicinity if they are in vicinity
      if (o.isInVicinity) {
        o.isInVicinity = false;
        if (this.onLeaveVicinity) this.onLeaveVicinity(o.id);
        o.setDefaultTexture();
      }

      // Stop streaming to a zone if they are currently doing so,
      // Since the users are not in the same zone.
      if (o.media.currentAction === Action.InZone) {
        o.media.currentAction = Action.Traversing;
        removeZonemate(o.id);
      }

      // Mute the other user's default audio
      o.media.muteAudio();
      return;
    }
  }

  private async checkFurniture(other: ICollider) {
    if (
      !this.isLocal &&
      this.zoneData.zoneID === broadcastZoneID &&
      other instanceof BroadcastZone
    ) {
      other.occupantID = this.id;
      return;
    }

    if (other instanceof BroadcastZone) {
      const o = <BroadcastZone>other;
      if (o) o.tryInteract(this);
      return;
    }

    if (other instanceof DeskZone) {
      const o = <DeskZone>other;
      if (o) o.tryInteract(this);
    }
  }

  private streamVideo(newTrack: MediaStreamTrack) {
    this.media.updateVideoSource(newTrack);
    if (this.media.cameraDisabled) {
      if (this.textureType === TextureType.Video) {
        this.setDefaultTexture();
      }
      return;
    }

    if (this.isLocal) {
      this.setVideoTexture();
    }
  }

  private streamAudio(newTrack: MediaStreamTrack) {
    this.media.updateAudioSource(newTrack);
  }

  private setDefaultTexture() {
    if (this.textureType === TextureType.Default) return;
    // I am not (yet) sure why this is needed, but without
    // it we get inconsistent bounds and broken collision
    // detection when switching textures.
    this.getBounds(true);

    const t = Textures.get();
    const texture = t.catalog[this.gradientTextureName];

    if (!texture) {
      t.enqueue(
        this,
        this.gradientTextureName,
        (renderer: PIXI.Renderer | PIXI.AbstractRenderer): PIXI.Texture => {
          return this.generateTexture(renderer);
        },
        false
      );
      return;
    }

    this.texture = texture;
    this.textureType = TextureType.Default;
  }

  private async proximityUpdate(other: User) {
    // Check that we aren't updating proximity against ourselves
    if (other.id === this.id) {
      return;
    }

    const distance = this.distanceTo(other.getPos());

    // Calculate the target alpha of the other user based on their
    // distance from the user running this update.
    other.alpha =
      (this.earshotDistance * 1.5 - distance) / this.earshotDistance;

    // Do vicinity checks. This is where track subscription and unsubscription
    // will happen. We do it when the user is in vicinity rather than earshot
    // to prepare the tracks in advance, creating a more seamless transition when
    // the user needs the tracks.
    if (this.inVicinity(distance)) {
      // If we just entered vicinity, trigger onEnterVicinity
      if (!other.isInVicinity) {
        other.isInVicinity = true;
        if (this.onEnterVicinity) {
          this.onEnterVicinity(other.id);
        }
      }
    } else if (other.isInVicinity) {
      // If we just left vicinity, trigger onLeaveVicinity
      other.isInVicinity = false;
      if (this.onLeaveVicinity) {
        this.onLeaveVicinity(other.id);
      }
    }

    // Do earshot checks

    // User is in earshot
    if (this.inEarshot(distance)) {
      console.log("user is in earshot:", distance);
      const pm = this.getPannerMod(distance, other.getPos());
      other.media.updatePanner(pm.pos, pm.pan);

      other.media.unmuteAudio();
      if (
        !other.media.cameraDisabled &&
        other.textureType != TextureType.Video
      ) {
        other.setVideoTexture();
      }
      return;
    }

    other.media.muteAudio();
    other.setDefaultTexture();
  }

  private getPannerMod(
    distance: number,
    otherPos: Pos
  ): { pos: Pos; pan: number } {
    const desiredPannerDistance =
      (distance * maxPannerDistance) / this.earshotDistance;

    const dx = otherPos.x - this.x;
    const dy = otherPos.y - this.y;

    const part = desiredPannerDistance / distance;

    const panValue = (1 * dx) / this.earshotDistance;

    return {
      pos: {
        x: Math.round(otherPos.x + dx * part),
        y: Math.round(otherPos.y + dy * part),
      },
      pan: panValue,
    };
  }

  protected distanceTo(other: Pos) {
    // We need to get distance from the center of the user
    const thisX = Math.round(this.x + baseSize / 2);
    const thisY = Math.round(this.y + baseSize / 2);

    const otherX = Math.round(other.x + baseSize / 2);
    const otherY = Math.round(other.y + baseSize / 2);
    const dist = Math.hypot(otherX - thisX, otherY - thisY);
    return Math.round(dist);
  }

  private inEarshot(distance: number) {
    return distance < this.earshotDistance;
  }

  private inVicinity(distance: number) {
    return distance < this.earshotDistance * 2;
  }

  private generateTexture(
    renderer: PIXI.Renderer | PIXI.AbstractRenderer
  ): PIXI.Texture {
    const cont = new PIXI.Container();
    cont.x = 0;
    cont.y = 0;
    cont.width = this.width;
    cont.height = this.height;

    const graphics = new PIXI.Graphics();
    graphics.beginFill(0x1f2d3d, 1);
    graphics.lineStyle(1, 0x121a24, 1);

    graphics.drawRoundedRect(0, 0, this.width, this.height, 3);
    graphics.endFill();
    cont.addChild(graphics);

    const txt = new PIXI.Text(this.emoji, {
      fontFamily: "Arial",
      fontSize: 24,
      fill: 0xff1010,
      align: "center",
    });
    txt.anchor.set(0.5);
    txt.position.x = cont.x + cont.width / 2;
    txt.position.y = cont.y + cont.height / 2;

    cont.addChild(txt);

    const texture = renderer.generateTexture(cont);
    return texture;
  }
}
