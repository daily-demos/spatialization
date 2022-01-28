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
    const w = document.getElementById("world");

    // Create PixiJS Application and set its size to
    // our "world" div.
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
    frame.drawRect(0, 0, this.app.renderer.width, this.app.renderer.height);
    frame.position.set(0, 0);
    this.app.stage.addChild(frame);

    // Main world container, which will hold user
    // and furniture containers.
    this.worldContainer = new PIXI.Container();
    this.worldContainer.width = defaultWorldSize;
    this.worldContainer.height = defaultWorldSize;
    this.worldContainer.sortableChildren = true;

    const floor = new Floor(defaultWorldSize, defaultWorldSize);
    this.worldContainer.addChild(floor);

    frame.addChild(this.worldContainer);

    // Container that will hold our users
    this.usersContainer = new PIXI.Container();
    this.usersContainer.width = this.worldContainer.width;
    this.usersContainer.height = this.worldContainer.height;
    this.usersContainer.zIndex = 100;
    this.worldContainer.addChild(this.usersContainer);

    // Container that will hold our room "furniture" elements,
    // like broadcast spots
    this.furnitureContainer = new PIXI.Container();
    this.furnitureContainer.zIndex = 90;
    this.furnitureContainer.width = this.worldContainer.width;
    this.furnitureContainer.height = this.worldContainer.height;
    this.worldContainer.addChild(this.furnitureContainer);

    document.getElementById("world").appendChild(this.app.view);
  }

  updateUser(
    id: string,
    name: string,
    video: MediaStreamTrack = null,
    audio: MediaStreamTrack = null
  ) {
    const user = this.getUser(id);
    if (user) {
      user.updateTracks(video, audio);
      if (!user.isLocal) user.setUserName(name);
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
    this.localUser.updateStoredZonemates(user);

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
      user = this.createUser(sessionID, -10000, -1000, userName);
    }
    user.setUserName(userName);
  }

  updateParticipantPos(sessionID: string, posX: number, posY: number) {
    let user = this.getUser(sessionID);
    if (!user) {
      user = this.createUser(sessionID, posX, posY);
    }
    user.moveTo({ x: posX, y: posY });
  }

  initLocalUser(sessionID: string, videoTrack: MediaStreamTrack): void {
    window.audioContext = new AudioContext();

    const worldCenter = defaultWorldSize / 2;

    // These position constraints are largely arbitrary;
    // I just felt with what spawning area "feels" right.
    const p = {
      x: rand(worldCenter - 300, worldCenter + 300),
      y: rand(worldCenter - 250, worldCenter + 250),
    };

    const user = this.createUser(sessionID, p.x, p.y, "You", true);
    // This will render the world and allow us to cross
    // check collision, to make sure the local user is not
    // colliding with furniture.
    this.app.render();

    // Make sure we aren't colliding with any furniture,
    // reposition if so.
    this.getFinalLocalPos(user);

    this.localUser = user;
    const finalPos = this.localUser.getPos();

    // Center world container on local user
    this.worldContainer.position.x =
      this.app.view.width / 2 - finalPos.x - this.localUser.width / 2;
    this.worldContainer.position.y =
      this.app.view.height / 2 - finalPos.y - this.localUser.height / 2;

    user.updateTracks(videoTrack, null);
    this.sendZoneData();
    this.sendPosData();
    this.keyListener.listenKeys();
  }

  removeUser(userId: string): void {
    const user = this.getUser(userId);
    if (!user) return;

    // Update zone back to global to make sure
    // zone spots are freed up.
    this.updateParticipantZone(userId, globalZoneID);
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
    this.app.ticker.add((deltaTime) => {
      this.update(deltaTime);
    });

    // Ensure our world is correctly sized
    this.app.resize();

    // Create a single broadcast spot
    const zoneBroadcast = new BroadcastZone(
      broadcastZoneID,
      0,
      defaultWorldSize / 2
    );
    zoneBroadcast.moveTo({
      x: defaultWorldSize / 2 - zoneBroadcast.width / 2,
      y: zoneBroadcast.y,
    });
    this.furnitureContainer.addChild(zoneBroadcast);
    this.furniture.push(zoneBroadcast);

    // Create two desk zones
    const yPos = defaultWorldSize / 2 + 325;
    const zone1 = new DeskZone(1, "Koala", 4, { x: 0, y: yPos });
    zone1.moveTo({
      x: defaultWorldSize / 2 - zone1.width - zoneBroadcast.width,
      y: zone1.y,
    });
    this.furnitureContainer.addChild(zone1);
    this.furniture.push(zone1);

    const zone2 = new DeskZone(2, "Kangaroo", 4, { x: 0, y: yPos });
    zone2.moveTo({ x: defaultWorldSize / 2 + zoneBroadcast.width, y: zone2.y });
    this.furnitureContainer.addChild(zone2);
    this.furniture.push(zone2);
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
    userName: string = null,
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
      userName,
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
      user.moveTo(np);
      return this.getFinalLocalPos(user);
    }
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
    // Figure out what our real speed should be.
    // Using the local user's default speed and
    // the delta since the last tick.
    const s = delta * this.localUser.speed;

    // Get the user's current position, and set
    // their new coordinates to the same
    // x and y values.
    const currentPos = this.localUser.getPos();
    let newX = currentPos.x;
    let newY = currentPos.y;

    // If arrow keys or WASD are pressed, update
    // the new x and y values using the speed
    // we calculated above.
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

    // If no keys were pressed, the coordintates remain
    // identical. Early out, nothing more to do.
    if (newX === currentPos.x && newY === currentPos.y) {
      return;
    }
    // If the user moved, move them to the new coordinates.
    this.localUser.moveTo({ x: newX, y: newY });

    // Iterate over all furniture and, if the new position
    // results in them colliding with an object that has
    // physics enabled, reset their pos to their previous
    // position and return.
    for (let o of this.furniture) {
      if (o.physics && o.hits(this.localUser)) {
        this.localUser.moveTo(currentPos);
        return;
      }
    }

    // Get the final new position of the user.
    const newPos = this.localUser.getPos();

    // Center world container on local user.
    this.worldContainer.position.x =
      this.app.view.width / 2 - newPos.x - this.localUser.width / 2;
    this.worldContainer.position.y =
      this.app.view.height / 2 - newPos.y - this.localUser.height / 2;

    // Send their new position data to other participants.
    this.sendPosData();
  }

  private getUser(id: string): User {
    return <User>this.usersContainer.getChildByName(id);
  }

  private async sendPosData() {
    const lu = this.localUser;
    const zd = lu.getZoneData();
    const zID = zd.zoneID;

    // If we're in the global zone, broadcast to everyone
    if (zID === globalZoneID) {
      this.onMove(lu.getPos());
      return;
    }

    // If we are in an isolated zone and have zonemates,
    // only broadcast to them
    const zonemates = lu.getZonemates();
    for (let zm in zonemates) {
      this.onMove(lu.getPos(), zm);
    }
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
    if (!this.localUser) return;
    console.log("sending data dump to", sessionID);

    const la = this.localUser;
    const pd = la.getPos();
    const zd = la.getZoneData();
    this.onDataDump(zd, pd, sessionID);
  }

  destroy() {
    Textures.destroy();
    this.localUser = null;
    this.furniture = [];
    this.robots = [];
    this.app.destroy(true, true);
  }
}
