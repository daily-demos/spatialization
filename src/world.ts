import * as PIXI from "pixi.js";

import KeyListener from "./util/nav";
import { User } from "./models/user";
import { rand } from "./util/math";
import Floor from "./models/floor";
import { BroadcastZone } from "./models/broadcastZone";
import { IAudioContext, AudioContext } from "standardized-audio-context";
import { ICollider } from "./models/collider";
import { Robot, RobotRole } from "./models/robot";
import { Pos, ZoneData } from "./worldTypes";
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
  onMove: (pos: Pos, recipient?: string) => void = null;
  onJoinZone: (zoneData: ZoneData, recipient?: string) => void = null;
  onDataDump: (zoneData: ZoneData, posData: Pos, recipient?: string) => void =
    null;

  private keyListener = new KeyListener();
  private localUser: User = null;

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
    audio: MediaStreamTrack = null
  ) {
    const user = this.getUser(id);
    if (user) {
      user.updateTracks(video, audio);
    }
  }

  updateParticipantZone(
    sessionID: string,
    zoneID: number,
    spotID: number = -1
  ) {
    let user = this.getUser(sessionID);
    if (!user) {
      user = this.createUser(sessionID, -100, -100);
    }
    const priorZone = user.getZoneData();
    const oldZoneID = priorZone.zoneID;
    const oldSpotID = priorZone.spotID;
    user.updateZone(zoneID, spotID);

    if (user.isZonemate(this.localUser)) {
      // Send data back to make sure the newly joined participant knows exactly
      // where we are
      this.sendPosDataToParticipant(sessionID);
    }

    let handledOldPlacement = false;
    let handledNewPlacement = false;

    // Iterate through all furniture and try to place/unplace user in
    // communicated zone and spot as needed. "Placement" does not impact
    // user behavior itself (that is done via `user.updateZone()` above).
    // Placement affects zone spot occupation status and remote positioning.
    if (zoneID === broadcastZoneID) {
      for (let item of this.furniture) {
        if (item instanceof BroadcastZone) {
          item.tryPlace(user);
        }
      }
    } else if (oldZoneID === broadcastZoneID) {
      for (let item of this.furniture) {
        if (item instanceof BroadcastZone) {
          item.tryUnplace(user.id);
        }
      }
    }

    for (let item of this.furniture) {
      if (item instanceof DeskZone) {
        if (item.id === oldZoneID) {
          item.tryUnplace(user.id, oldSpotID);
          // If the remote user has moved to the global zone, just
          // unplace them from previous zone and return
          if (zoneID === globalZoneID) return;
          handledOldPlacement = true;
        }
        if (
          zoneID !== globalZoneID &&
          !handledNewPlacement &&
          item.id === zoneID
        ) {
          item.tryPlace(user, spotID);
          if (handledOldPlacement || oldZoneID === globalZoneID) return;
          handledNewPlacement = true;
        }
      }
    }
  }

  initRemoteParticpant(sessionID: string, userName: string) {
    // User may have been created as part of an out of order
    // update. If it already exists, just update the name
    let user = this.getUser(sessionID);
    if (!user) {
      user = this.createUser(sessionID, -10000, -1000);
    }
    user.userName = userName;
  }

  updateParticipantPos(sessionID: string, posX: number, posY: number) {
    let user = this.getUser(sessionID);
    if (!user) {
      user = this.createUser(sessionID, posX, posY);
    }
    user.moveTo({ x: posX, y: posY });
    //  user.checkFurnitures(this.furniture);
  }

  initLocalUser(sessionID: string): void {
    this.initAudioContext();

    const worldCenter = defaultWorldSize / 2;
    const p = {
      x: rand(worldCenter - 300, worldCenter + 300),
      y: rand(worldCenter - 250, worldCenter + 250),
    };

    const user = this.createUser(sessionID, p.x, p.y, true);
    this.app.render();

    this.getFinalLocalPos(user);
    user.moveTo(user.getPos());

    this.localUser = user;
    const finalPos = this.localUser.getPos();

    // Center world container on local user
    this.worldContainer.position.x =
      this.app.view.width / 2 - finalPos.x - this.localUser.width / 2;
    this.worldContainer.position.y =
      this.app.view.height / 2 - finalPos.y - this.localUser.height / 2;
    if (this.onCreateUser) {
      this.onCreateUser();
    }
    this.sendZoneData();
    this.sendPosData();
    this.keyListener.listenKeys();
  }

  removeUser(userId: string): void {
    const user = this.getUser(userId);
    if (!user) return;
    user.destroy();
    this.usersContainer.removeChild(user);
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
    spot.moveTo({ x: defaultWorldSize / 2 - spot.width / 2, y: spot.y });
    this.furnitureContainer.addChild(spot);
    this.furniture.push(spot);

    const yPos = defaultWorldSize / 2 + 275;

    const zone1 = new DeskZone(1, "Koala", 4, { x: 0, y: yPos });
    zone1.moveTo({
      x: defaultWorldSize / 2 - zone1.width - spot.width,
      y: zone1.y,
    });
    this.furnitureContainer.addChild(zone1);
    this.furniture.push(zone1);

    const zone2 = new DeskZone(2, "Kangaroo", 4, { x: 0, y: yPos });
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

          const spot = desk.getSpots()[0];
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

  private createUser(
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
    const user = new User(
      userID,
      x,
      y,
      (isLocal = isLocal),
      (onEnterVicinity = onEnterVicinity),
      (onLeaveVicinity = onLeaveVicinity),
      onJoinZone
    );
    this.usersContainer.addChild(user);
    return user;
  }

  private getFinalLocalPos(user: User): void {
    for (let item of this.furniture) {
      let doesHit = false;
      if (item instanceof DeskZone) {
        const z = <DeskZone>item;
        if (z.hitsSpot(user)) {
          doesHit = true;
        }
      }
      if (!doesHit && item.hits(user)) {
        doesHit = true;
      }

      if (!doesHit) continue;

      console.log(
        "User will hit furniture; finding new position:",
        user.getPos()
      );

      const worldCenter = defaultWorldSize / 2;
      const np = {
        x: rand(worldCenter - 500, worldCenter + 500),
        y: rand(worldCenter - 500, worldCenter + 500),
      };
      user.moveTo(np, true);
      return this.getFinalLocalPos(user);
    }
  }

  private init() {
    //  PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
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

    if (!this.localUser) return;

    // Update all robots
    for (let robot of this.robots) {
      robot.update();
      robot.checkFurnitures(this.furniture);
    }

    this.localUser.processUsers(this.usersContainer.children);
    this.localUser.checkFurnitures(this.furniture);
    this.checkNavigation(delta);
  }

  private checkNavigation(delta: number) {
    const s = delta * this.localUser.speed;

    let newX = this.localUser.x;
    let newY = this.localUser.y;
    const currentPos = this.localUser.getPos();

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

    this.localUser.moveTo({ x: newX, y: newY }, true);

    for (let o of this.furniture) {
      if (o.physics && o.hits(this.localUser)) {
        this.localUser.moveTo(currentPos, true);
        return;
      }
    }

    this.localUser.moveTo({ x: newX, y: newY }, false);
    const newPos = this.localUser.getPos();
    // Center world container on local user
    this.worldContainer.position.x =
      this.app.view.width / 2 - newPos.x - this.localUser.width / 2;
    this.worldContainer.position.y =
      this.app.view.height / 2 - newPos.y - this.localUser.height / 2;

    this.sendPosData();
  }

  private getUser(id: string): User {
    return <User>this.usersContainer.getChildByName(id);
  }

  private async sendPosData() {
    const lu = this.localUser;
    const zd = lu.getZoneData();
    const zID = zd.zoneID;
    // If we are in an isolated zone and have zonemates,
    // only broadcast to them
    if (zID !== globalZoneID && zID !== broadcastZoneID) {
      const zonemates = lu.getZonemates();
      for (let zm of zonemates) {
        this.onMove(lu.getPos(), zm);
      }
      return;
    }
    // If we're in the global zone, broadcast to everyone
    this.onMove(lu.getPos());
  }

  private async sendZoneData() {
    const lu = this.localUser;
    const zd = lu.getZoneData();
    this.onJoinZone(zd, "*");
  }

  sendPosDataToParticipant(sessionID: string) {
    const la = this.localUser;
    this.onMove(la.getPos(), sessionID);
  }

  sendZoneDataToParticipant(sessionID: string) {
    const la = this.localUser;
    const zd = la.getZoneData();
    this.onJoinZone(zd, sessionID);
  }

  sendDataDumpToParticipant(sessionID: string) {
    const la = this.localUser;
    const pd = la.getPos();
    const zd = la.getZoneData();
    this.onDataDump(zd, pd, sessionID);
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
