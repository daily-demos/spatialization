import * as PIXI from "pixi.js";

import KeyListener, { removeZonemate } from "./util/nav";
import { User } from "./models/user";
import { rand } from "./util/math";
import Floor from "./models/floor";
import { BroadcastSpot } from "./models/broadcast";
import { IAudioContext, AudioContext } from "standardized-audio-context";
import { Desk } from "./models/desk";
import { Collider } from "./models/collider";
import { Robot, RobotRole } from "./models/robot";
import { Pos, Size } from "./worldTypes";
import { Textures } from "./textures";

declare global {
  interface Window {
    audioContext: IAudioContext;
  }
}

const defaultWorldSize = 1000;

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

  updateParticipantZone(sessionID: string, zoneID: number, pos: Pos) {
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
    avatar.checkFurniture(this.furnitureContainer.children);
  }

  initLocalAvatar(sessionID: string) {
    const p = {
      x: rand(150, 450),
      y: rand(150, 450),
    };
    const avatar = this.createAvatar(sessionID, p.x, p.y, true);

    const finalPos = this.getFinalLocalPos(avatar.getSize(), p);
    avatar.moveTo(finalPos);
    this.localAvatar = avatar;

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
    this.initAudioContext();
  }

  private getFinalLocalPos(size: Size, proposedPos: Pos): Pos {
    for (let item of this.furnitureContainer.children) {
      const collider = <Collider>item;
      // I am not yet sure why this is required it. Without it, 
      // collision check below is extremely unreliable
      collider.getBounds(false);
      if (collider.willHit(size, proposedPos, true)) {
        console.log("User will hit furniture; finding new position:", proposedPos);
        proposedPos = {
          x: rand(50, 450),
          y: rand(50, 450),
        };
        return this.getFinalLocalPos(size, proposedPos);
      }
    }
    return proposedPos;
  }

  private init() {
    this.app = new PIXI.Application({
      width: 500,
      height: 500,
      backgroundColor: 0xeefae0,
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

    const floor = new Floor();
    this.worldContainer.addChild(floor);

    frame.addChild(this.worldContainer);

    // Add container that will hold our users
    this.usersContainer = new PIXI.Container();
    this.usersContainer.width = this.worldContainer.width;
    this.usersContainer.height = this.worldContainer.height;
    this.usersContainer.zIndex = 100;
    this.worldContainer.addChild(this.usersContainer);

    document.getElementById("world").appendChild(this.app.view);
    this.app.ticker.add((deltaTime) => {
      this.draw(this.app.ticker.elapsedMS);
      this.update(deltaTime);
    });
  }

  start() {
    // Container that will hold our room "furniture" elements,
    // like broadcast spots
    this.furnitureContainer = new PIXI.Container();
    this.furnitureContainer.zIndex = 90;
    this.furnitureContainer.width = this.worldContainer.width;
    this.furnitureContainer.height = this.worldContainer.height;
    // Create a single broadcast spot
    const spot = new BroadcastSpot(
      0,
      0,
      50,
      this.subToTracks,
      this.unsubFromTracks
    );
    spot.x = defaultWorldSize / 2 - spot.width / 2;
    this.furnitureContainer.addChild(spot);

    const desk1 = new Desk(1, 4, 0, 250);
    desk1.x = defaultWorldSize / 2 - desk1.width - spot.width;
    this.furnitureContainer.addChild(desk1);

    const desk2 = new Desk(2, 4, 0, 250);
    desk2.x = defaultWorldSize / 2 + spot.width;
    this.furnitureContainer.addChild(desk2);

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
        if (item instanceof Desk) {
          const desk = <Desk>item;
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
        if (item instanceof BroadcastSpot) {
          const spot = <BroadcastSpot>item;
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
    if (isLocal) {
      onEnterVicinity = this.subToTracks;
      onLeaveVicinity = this.unsubFromTracks;
    }
    const avatar = new User(
      userID,
      x,
      y,
      (isLocal = isLocal),
      (onEnterVicinity = onEnterVicinity),
      (onLeaveVicinity = onLeaveVicinity),
      this.onJoinZone
    );
    this.usersContainer.addChild(avatar);
    return avatar;
  }

  removeAvatar(userId: string) {
    const avatar = this.getAvatar(userId);
    if (!avatar) return;
    this.usersContainer.removeChild(avatar);
    for (let i = 0; i < this.robots.length; i++) {
      const robot = this.robots[i];
      if (robot.id === userId) {
        this.robots.splice(i, 1);
        i--;
      }
    }
  }

  private draw(elapsedMS: number) {}

  private update(delta: number) {
    if (!this.localAvatar) return;
    // Process texture queue
    const textures = Textures.get();
    textures.processQueue(this.app.renderer);

    // Update all robots
    for (let robot of this.robots) {
      robot.update();
      robot.checkFurniture(this.furnitureContainer.children);
    }

    this.localAvatar.processUsers(this.usersContainer.children);
    this.localAvatar.checkFurniture(this.furnitureContainer.children);

    const s = delta * this.localAvatar.speed;

    let newX = this.localAvatar.x;
    let newY = this.localAvatar.y;

    this.keyListener.on("w", () => {
      newY -= s;
    });

    this.keyListener.on("s", () => {
      newY += s;
    });

    this.keyListener.on("a", () => {
      newX -= s;
    });

    this.keyListener.on("d", () => {
      newX += s;
    });

    for (let o of this.furnitureContainer.children) {
      if (o instanceof Collider) {
        const c = <Collider>o;
        if (
          c.physics &&
          c.willHit(this.localAvatar.getSize(), { x: newX, y: newY }, false)
        ) {
          return;
        }
      }
    }

    this.localAvatar.moveTo({ x: newX, y: newY });

    const pos = this.localAvatar.getPos();

    // Center world container on local avatar
    this.worldContainer.position.x =
      this.app.view.width / 2 - pos.x - this.localAvatar.width / 2;
    this.worldContainer.position.y =
      this.app.view.height / 2 - pos.y - this.localAvatar.height / 2;

    this.sendData();
  }

  private getAvatar(id: string): User {
    return <User>this.usersContainer.getChildByName(id);
  }

  private async sendData() {
    const la = this.localAvatar;
    this.onMove(la.getZone(), la.getPos());
  }

  sendDataToParticipant(sessionID: string) {
    const la = this.localAvatar;
    this.onMove(la.getZone(), la.getPos(), sessionID);
  }

  destroy() {
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
