import { Collider, ICollider } from "./collider";
import * as PIXI from "pixi.js";
import { DisplayObject, MIPMAP_MODES } from "pixi.js";
import { BroadcastZone } from "./broadcastZone";
import { Action, UserMedia } from "./userMedia";
import { Pos, Size, ZoneData } from "../worldTypes";
import { Textures } from "../textures";
import { DeskZone } from "./deskZone";
import { broadcastZoneID, globalZoneID, standardTileSize } from "../config";
import { clamp } from "../util/math";

const minAlpha = 0.2;
const inZoneAlpha = 0.5;
const earshot = 400;
const maxAlpha = 1;
const baseSize = standardTileSize;
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

  private userName: string;
  private videoTextureAttemptPending: number = null;

  protected emoji: string = "😊";
  protected gradientTextureName: string = "user-gradient";

  private textureType = TextureType.Unknown;
  private zoneData: ZoneData = { zoneID: 0, spotID: -1 };

  private earshotDistance: number;
  private onEnterVicinity: Function;
  private onLeaveVicinity: Function;
  private onJoinZone: (zoneData: ZoneData, recipient?: string) => void;
  private localZoneMates: { [key: string]: void } = {};
  constructor(
    id: string,
    userName: string,
    x: number,
    y: number,
    isLocal = false,
    onEnterVicinity: Function = null,
    onLeaveVicinity: Function = null,
    onJoinZone: (zoneData: ZoneData, recipient?: string) => void = null
  ) {
    super();
    this.media = new UserMedia(id, userName, isLocal);

    this.speed = defaultSpeed;
    // How close another user needs to be to be seen/heard
    // by this user
    this.earshotDistance = earshot;
    this.onEnterVicinity = onEnterVicinity;
    this.onLeaveVicinity = onLeaveVicinity;
    this.onJoinZone = onJoinZone;
    this.isLocal = isLocal;
    this.id = id;
    this.userName = userName;
    // This field is on the Pixi base class. It is
    // different from the userName and MUST match
    // the unique ID.
    this.name = id;
    this.x = x;
    this.y = y;
    this.height = baseSize;
    this.width = baseSize;
    if (!isLocal) {
      this.alpha = minAlpha;
    } else {
      this.alpha = maxAlpha;
    }

    this.setDefaultTexture();
  }

  destroy() {
    this.media.leaveZone();
    this.media.leaveBroadcast();
    this.media.destroy();
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

  // updateZone updates the zone ID of the user
  updateZone(zoneID: number, spotID: number = -1) {
    const oldZoneID = this.zoneData.zoneID;
    const oldSpotID = this.zoneData.spotID;

    if (zoneID === oldZoneID && spotID === oldSpotID) return;

    this.zoneData.zoneID = zoneID;
    this.zoneData.spotID = spotID;

    if (oldZoneID === broadcastZoneID) {
      this.media.leaveBroadcast();
    }

    if (zoneID === broadcastZoneID) {
      this.alpha = maxAlpha;
      this.media.enterBroadcast();
    }

    if (this.isLocal) {
      if (oldZoneID !== globalZoneID) {
        this.localZoneMates = {};
      }
      if (this.onJoinZone) this.onJoinZone({ zoneID: zoneID, spotID: spotID });
      if (zoneID === globalZoneID) {
        this.setVideoTexture();
        this.media.leaveZone();
        return;
      }
      if (zoneID !== globalZoneID && zoneID !== broadcastZoneID) {
        this.media.enterZone();
      }
      this.setDefaultTexture();
      return;
    }
    if (zoneID !== globalZoneID) this.setDefaultTexture();
  }

  getZoneData(): ZoneData {
    return this.zoneData;
  }

  updateStoredZonemates(other: User) {
    if (this.isZonemate(other)) {
      if (this.zoneData.zoneID !== globalZoneID) {
        this.doSaveZonemate(other.id);
      }
      return;
    }
    this.doForgetZonemate(other.id);
  }

  doSaveZonemate(id: string) {
    this.localZoneMates[id] = null;
  }

  doForgetZonemate(id: string) {
    delete this.localZoneMates[id];
  }

  isZonemate(other: User) {
    return this.zoneData.zoneID === other.zoneData.zoneID;
  }

  getZonemates(): { [key: string]: void } {
    return this.localZoneMates;
  }

  moveTo(pos: Pos, trial = false) {
    this.x = Math.round(pos.x);
    this.y = Math.round(pos.y);
    this.getBounds();
  }

  setUserName(newName: string) {
    if (newName === null || this.userName === newName) return;
    this.userName = newName;
    this.media.userName = newName;
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

  private setVideoTexture() {
    if (this.textureType === TextureType.Video) return;

    const videoTrack = this.media.getVideoTrack();
    if (!videoTrack) return;

    if (this.videoTextureAttemptPending) {
      if (Date.now() > this.videoTextureAttemptPending + 1000) {
        console.log("trying to play again", this.userName);
        this.media.videoTag.play();
        this.videoTextureAttemptPending = Date.now();
      }
      return;
    }

    if (!this.media.videoIsPlaying()) {
      console.log(
        "video not playing; will set texture when play starts",
        this.userName
      );
      this.videoTextureAttemptPending = Date.now();
      this.setDefaultTexture();
      this.media.addVideoPlayHandler(() => {
        console.log("video started playing - applying texture", this.userName);
        this.media.resetVideoPlayHandler();
        this.videoTextureAttemptPending = null;
        this.setVideoTexture();
      });
      return;
    }
    this.textureType = TextureType.Video;

    // I am not (yet) sure why this is needed, but without
    // it we get inconsistent bounds and broken collision
    // detection when switching textures.
    this.getBounds(true);

    let texture = new PIXI.BaseTexture(this.media.videoTag, {
      mipmap: MIPMAP_MODES.OFF,
      resourceOptions: {
        updateFPS: 0,
      },
    });
    texture.onError = (e) => this.textureError(e);
    let textureMask: PIXI.Rectangle = null;
    const resource = texture.resource;
    let x = 0;
    let y = 0;
    let size = baseSize;
    if (resource.width > resource.height) {
      x = resource.height / 2;
      size = resource.height;
    } else if (resource.width < resource.height) {
      y = resource.width / 2;
      size = resource.width;
    } else {
      console.log("setting real size", this.userName);
      texture.setSize(baseSize, baseSize);
    }
    textureMask = new PIXI.Rectangle(x, y, size, size);

    this.texture = new PIXI.Texture(texture, textureMask);
    this.texture.update();
    this.width = baseSize;
    this.height = baseSize;
  }

  private textureError(err: ErrorEvent) {
    console.error("PIXI base texture error:", err);
  }

  private async processUser(o: User) {
    // If this is the local user, skip
    if (o.id === this.id) {
      if (this.textureType === TextureType.Unknown) {
        this.setDefaultTexture();
      }
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
      this.doSaveZonemate(o.id);

      if (o.media.currentAction !== Action.InZone) {
        if (!o.isInVicinity) {
          o.alpha = 1;
          o.isInVicinity = true;
          if (this.onEnterVicinity) this.onEnterVicinity(o.id);
        }
        o.media.enterZone();
      }
      // Mute the other user's default audio, since we'll
      // be streaming via a zone.
      o.media.muteAudio();
      return;
    }

    if (ozID !== tzID) {
      // If the other user is broadcasting...
      if (o.media.currentAction === Action.Broadcasting) {
        if (!o.isInVicinity) {
          o.isInVicinity = true;
          if (this.onEnterVicinity) this.onEnterVicinity(o.id);
        }
        return;
      }

      // If the other user is not in a default zone but the zone does
      // NOT match local user...
      o.alpha = inZoneAlpha;

      // Leave vicinity if they are in vicinity
      if (o.isInVicinity) {
        o.isInVicinity = false;
        if (this.onLeaveVicinity) this.onLeaveVicinity(o.id);
        o.setDefaultTexture();
      }

      // Stop streaming to a zone if they are currently doing so,
      // Since the users are not in the same zone.
      if (o.media.currentAction === Action.InZone) {
        o.media.leaveZone();
      }

      // Mute the other user's default audio
      o.media.muteAudio();
      return;
    }
  }

  private async checkFurniture(other: ICollider) {
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

    if (this.isLocal && this.zoneData.zoneID === globalZoneID) {
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
      const pm = this.getAudioMod(distance, other.getPos());
      other.media.updateAudio(pm.gain, pm.pan);
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

  private getAudioMod(
    distance: number,
    otherPos: Pos
  ): { gain: number; pan: number } {
    let gainValue = clamp(
      ((this.earshotDistance - distance) * 0.5) / this.earshotDistance,
      0,
      0.5
    );

    const dx = otherPos.x - this.x;
    const panValue = (1 * dx) / this.earshotDistance;

    return {
      gain: gainValue,
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
    return distance <= this.earshotDistance;
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
