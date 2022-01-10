import * as PIXI from "pixi.js";

import KeyListener from "./util/nav";
import { User } from "./models/user";
import { rand } from "./util/math";
import Floor from "./models/floor";
import { BroadcastZone } from "./models/broadcastZone";
import { IAudioContext, AudioContext } from "standardized-audio-context";
import { ICollider } from "./models/collider";
import { Robot, RobotRole } from "./models/robot";
import { Pos } from "./worldTypes";
import { Textures } from "./textures";
import { DeskZone } from "./models/deskZone";
import { broadcastZoneID, defaultWorldSize, globalZoneID } from "./config";

declare global {
  interface Window {
    audioContext: IAudioContext;
  }
}

export class World {
  subToTracks: (sessionID: string) => void = null;
  unsubFromTracks: (sessionID: string) => void = null;
  onCreateUser: () => void = null;
  onMove: (zoneID: number, pos: Pos, recipient?: string) => void = null;
  onJoinZone: (sessionID: string, zoneID: number, pos: Pos) => void = null;

  private keyListener = new KeyListener();
  private localAvatar: User = null;

  private app: PIXI.Application = null;
  private worldContainer: PIXI.Container = null;
  private usersContainer: PIXI.Container = null;
  private furnitureContainer: PIXI.Container = null;

  private robots: Array<Robot> = [];
  private furniture: Array<ICollider> = [];

  constructor() {
    this.init();
  }

  setUserTracks(
    id: string,
    video: MediaStreamTrack = null,
    audio: MediaStreamTrack = null,
    screen: MediaStreamTrack = null
  ) {
    const avatar = this.getAvatar(id);
    if (avatar) {
      avatar.updateTracks(video, audio);
    }
  }

  updateParticipantZone(
    sessionID: string,
    zoneID: number,
    pos: Pos,
    spotID: number = -1
  ) {
    let avatar = this.getAvatar(sessionID);
    if (!avatar) {
      avatar = this.createAvatar(sessionID, pos.x, pos.y);
    }
    avatar.updateZone(zoneID);
    if (avatar.isZonemate(this.localAvatar)) {
      // Send data back to make sure the newly joined participant knows
      // we are in the same zone
      this.sendDataToParticipant(sessionID);
      return;
    }
    for (let item of this.furniture) {
      if (item instanceof DeskZone) {
        item.tryPlace(avatar, spotID);
        return;
      }
    }
  }

  initRemoteParticpant(sessionID: string, userName: string) {
    // Avatar may have been created as part of an out of order
    // update. If it already exists, just update the name
    let avatar = this.getAvatar(sessionID);
    if (!avatar) {
      avatar = this.createAvatar(sessionID, -10000, -1000);
    }
    avatar.setUserName(userName);
  }

  updateParticipantPos(
    sessionID: string,
    zoneID: number,
    posX: number,
    posY: number
  ) {
    let avatar = this.getAvatar(sessionID);
    if (!avatar) {
      avatar = this.createAvatar(sessionID, posX, posY);
      avatar.updateZone(zoneID);
    }
    if (avatar.getZone() !== zoneID) {
      avatar.updateZone(zoneID);
    }
    avatar.moveTo({ x: posX, y: posY });
    avatar.checkFurnitures(this.furniture);
  }

  initLocalAvatar(sessionID: string) {
    this.initAudioContext();

    const worldCenter = defaultWorldSize / 2;
    const p = {
      x: rand(worldCenter - 300, worldCenter + 300),
      y: rand(worldCenter - 250, worldCenter + 250),
    };

    const avatar = this.createAvatar(sessionID, p.x, p.y, true);
    this.app.render();

    this.getFinalLocalPos(avatar);
    avatar.moveTo(avatar.getPos());

    this.localAvatar = avatar;
    const finalPos = this.localAvatar.getPos();

    // Center world container on local avatar
    this.worldContainer.position.x =
      this.app.view.width / 2 - finalPos.x - this.localAvatar.width / 2;
    this.worldContainer.position.y =
      this.app.view.height / 2 - finalPos.y - this.localAvatar.height / 2;
    if (this.onCreateUser) {
      this.onCreateUser();
    }
    this.sendData();
    this.keyListener.listenKeys();
  }

  removeAvatar(userId: string) {
    const avatar = this.getAvatar(userId);
    if (!avatar) return;
    avatar.destroy();
    this.usersContainer.removeChild(avatar);
    for (let i = 0; i < this.robots.length; i++) {
      const robot = this.robots[i];
      if (robot.id === userId) {
        this.robots.splice(i, 1);
        i--;
      }
    }
  }

  start() {
    this.app.resize();
    // Container that will hold our room "furniture" elements,
    // like broadcast spots
    this.furnitureContainer = new PIXI.Container();
    this.furnitureContainer.zIndex = 90;
    this.furnitureContainer.width = this.worldContainer.width;
    this.furnitureContainer.height = this.worldContainer.height;
    // Create a single broadcast spot
    const spot = new BroadcastZone(broadcastZoneID, 0, defaultWorldSize / 2);
    spot.position.set(defaultWorldSize / 2 - spot.width / 2, spot.y);
    this.furnitureContainer.addChild(spot);
    this.furniture.push(spot);

    const yPos = defaultWorldSize / 2 + 200;

    const zone1 = new DeskZone(1, 4, { x: 0, y: yPos });
    zone1.moveTo({
      x: defaultWorldSize / 2 - zone1.width - spot.width,
      y: zone1.y,
    });
    this.furnitureContainer.addChild(zone1);
    this.furniture.push(zone1);

    const zone2 = new DeskZone(2, 4, { x: 0, y: yPos });
    zone2.moveTo({ x: defaultWorldSize / 2 + spot.width, y: zone2.y });
    this.furnitureContainer.addChild(zone2);
    this.furniture.push(zone2);

    // Add furniture container to the world
    this.worldContainer.addChild(this.furnitureContainer);
  }

  createRobot(userID: string) {
    console.log("Creating Robot", userID);

    // Check if there is aleady a desk robot
    let role = RobotRole.Desk;
    let foundDesk = false;
    let foundBroadcast = false;
    let persistentPos: Pos;
    for (let robot of this.robots) {
      if (robot.role === RobotRole.Desk) {
        // Desk robot already exist - revert to world
        foundDesk = true;
        continue;
      }
      if (robot.role === RobotRole.Broadcast) {
        foundBroadcast = true;
        continue;
      }
    }

    if (!foundDesk) {
      role = RobotRole.Desk;
      // Find a desk position
      for (let item of this.furnitureContainer.children) {
        if (item instanceof DeskZone) {
          const desk = <DeskZone>item;
          const spot = desk.spots[0];
          persistentPos = { x: desk.x + spot.x, y: desk.y + spot.y };
          break;
        }
      }
    }

    if (!foundBroadcast) {
      role = RobotRole.Broadcast;
      // Find a broadcast position
      for (let item of this.furnitureContainer.children) {
        if (item instanceof BroadcastZone) {
          const spot = <BroadcastZone>item;
          persistentPos = { x: spot.x, y: spot.y };
          break;
        }
      }
    }

    if (!persistentPos) {
      role = RobotRole.World;
    }

    const robot = new Robot(
      userID,
      userID,
      defaultWorldSize,
      defaultWorldSize,
      role
    );
    if (persistentPos) {
      robot.persistentPos = persistentPos;
    }
    this.robots.push(robot);
    this.usersContainer.addChild(robot);
  }

  private createAvatar(
    userID: string,
    x: number,
    y: number,
    isLocal = false
  ): User {
    let onEnterVicinity = null;
    let onLeaveVicinity = null;
    let onJoinZone = null;
    if (isLocal) {
      onEnterVicinity = this.subToTracks;
      onLeaveVicinity = this.unsubFromTracks;
      onJoinZone = this.onJoinZone;
    }
    const avatar = new User(
      userID,
      x,
      y,
      (isLocal = isLocal),
      (onEnterVicinity = onEnterVicinity),
      (onLeaveVicinity = onLeaveVicinity),
      onJoinZone
    );
    this.usersContainer.addChild(avatar);
    return avatar;
  }

  private getFinalLocalPos(avatar: User): void {
    for (let item of this.furniture) {
      let doesHit = false;
      if (item instanceof DeskZone) {
        const z = <DeskZone>item;
        if (z.hitsSpot(avatar)) {
          doesHit = true;
        }
      }
      if (!doesHit && item.hits(avatar)) {
        doesHit = true;
      }

      if (!doesHit) return;

      console.log(
        "User will hit furniture; finding new position:",
        avatar.getPos()
      );

      const worldCenter = defaultWorldSize / 2;
      const np = {
        x: rand(worldCenter - 500, worldCenter + 500),
        y: rand(worldCenter - 500, worldCenter + 500),
      };
      avatar.moveTo(np, true);
      return this.getFinalLocalPos(avatar);
    }
  }

  private init() {
    const w = document.getElementById("world");
    this.app = new PIXI.Application({
      width: w.offsetWidth,
      height: w.offsetHeight,
      resizeTo: w,
      backgroundColor: 0x121a24,
      resolution: 1,
    });

    this.app.ticker.maxFPS = 30;

    // Create window frame
    let frame = new PIXI.Graphics();
    frame.beginFill(0x121a24);
    frame.lineStyle({ color: 0xffffff, width: 4, alignment: 0 });
    frame.drawRect(0, 0, this.app.renderer.width, this.app.renderer.height);
    frame.position.set(0, 0);
    this.app.stage.addChild(frame);

    this.worldContainer = new PIXI.Container();
    this.worldContainer.width = defaultWorldSize;
    this.worldContainer.height = defaultWorldSize;
    this.worldContainer.sortableChildren = true;

    const floor = new Floor(defaultWorldSize, defaultWorldSize);
    this.worldContainer.addChild(floor);

    frame.addChild(this.worldContainer);

    // Add container that will hold our users
    this.usersContainer = new PIXI.Container();
    this.usersContainer.width = this.worldContainer.width;
    this.usersContainer.height = this.worldContainer.height;
    this.usersContainer.zIndex = 100;
    this.worldContainer.addChild(this.usersContainer);

    document.getElementById("world").appendChild(this.app.view);
    this.app.render();
    this.app.ticker.add((deltaTime) => {
      this.update(deltaTime);
    });
  }

  private update(delta: number) {
    // Process texture queue
    const textures = Textures.get();
    textures.processQueue(this.app.renderer);

    if (!this.localAvatar) return;

    // Update all robots
    for (let robot of this.robots) {
      robot.update();
      robot.checkFurnitures(this.furniture);
    }

    this.localAvatar.processUsers(this.usersContainer.children);
    this.localAvatar.checkFurnitures(this.furniture);
    this.checkNavigation(delta);
  }

  private checkNavigation(delta: number) {
    const s = delta * this.localAvatar.speed;

    let newX = this.localAvatar.x;
    let newY = this.localAvatar.y;
    const currentPos = this.localAvatar.getPos();

    this.keyListener.on("w", () => {
      newY -= s;
    });

    this.keyListener.on("ArrowUp", () => {
      newY -= s;
    });

    this.keyListener.on("s", () => {
      newY += s;
    });

    this.keyListener.on("ArrowDown", () => {
      newY += s;
    });

    this.keyListener.on("a", () => {
      newX -= s;
    });

    this.keyListener.on("ArrowLeft", () => {
      newX -= s;
    });

    this.keyListener.on("d", () => {
      newX += s;
    });

    this.keyListener.on("ArrowRight", () => {
      newX += s;
    });

    if (newX === currentPos.x && newY === currentPos.y) {
      return;
    }

    this.localAvatar.moveTo({ x: newX, y: newY }, true);

    for (let o of this.furniture) {
      if (o.physics && o.hits(this.localAvatar)) {
        this.localAvatar.moveTo(currentPos, true);
        return;
      }
    }

    this.localAvatar.moveTo({ x: newX, y: newY }, false);
    const newPos = this.localAvatar.getPos();
    // Center world container on local avatar
    this.worldContainer.position.x =
      this.app.view.width / 2 - newPos.x - this.localAvatar.width / 2;
    this.worldContainer.position.y =
      this.app.view.height / 2 - newPos.y - this.localAvatar.height / 2;

    this.sendData();
  }

  private getAvatar(id: string): User {
    return <User>this.usersContainer.getChildByName(id);
  }

  private async sendData() {
    const la = this.localAvatar;

    const lz = la.getZone();
    // If we are in an isolated zone and have zonemates,
    // only broadcast to them
    if (lz !== globalZoneID && lz !== broadcastZoneID) {
      const zonemates = la.getZonemates();
      console.log("In isolated zone! Only sending data to ", zonemates);
      for (let zm of zonemates) {
        this.onMove(la.getZone(), la.getPos(), zm);
      }
      return;
    }
    // If we're in the global zone, broadcast to everyone
    this.onMove(la.getZone(), la.getPos());
  }

  sendDataToParticipant(sessionID: string) {
    const la = this.localAvatar;
    this.onMove(la.getZone(), la.getPos(), sessionID);
  }

  destroy() {
    Textures.destroy();
    this.furniture = [];
    this.robots = [];
    this.app.destroy(true, true);
  }

  private initAudioContext() {
    window.audioContext = new AudioContext();
    const listener = window.audioContext.listener;
    listener.positionZ.value = 300 - 5;
    listener.forwardX.value = 0;
    listener.forwardY.value = 0;
    listener.forwardZ.value = -1;
    listener.upX.value = 0;
    listener.upY.value = 1;
    listener.upZ.value = 0;
  }
}
