import * as PIXI from "pixi.js";

import KeyListener, { removeZonemate } from "./util/nav";
import { User } from "./models/user";
import { lerp, rand } from "./util/math";
import Floor from "./models/floor";
import { BroadcastSpot } from "./models/broadcast";
import { AudioContext, IAudioContext } from "standardized-audio-context";
import { Desk } from "./models/desk";
import { Collider } from "./models/collider";
import { Robot, RobotRole } from "./models/robot";

declare global {
  interface Window {
    audioContext: IAudioContext;
  }
}

const defaultWorldSize = 1000;

export class World {
  onEnterVicinity: (sessionID: string) => void = null;
  onLeaveVicinity: (sessionID: string) => void = null;
  onCreateUser: () => void = null;
  onMove: (zoneID: number, pos: Pos, recipient?: string) => void = null;
  onEnterBroadcast: (sessionID: string) => void = null;
  onLeaveBroadcast: (sessioID: string) => void = null;
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

  updateParticipantZone(sessionID: string, zoneID: number) {
    const avatar = this.getAvatar(sessionID);
    // const oldZone = avatar.zoneID;
    avatar.zoneID = zoneID;
    if (zoneID === 0) return;
    if (avatar.zoneID === this.localAvatar.zoneID) {
      // Send data back to make sure the newly joined participant knows
      // we are in the same zone
      this.sendDataToParticipant(sessionID);
      return;
    }
  }

  updateParticipantPos(sessionID: string, posX: number, posY: number) {
    let avatar = this.getAvatar(sessionID);
    if (!avatar) {
      avatar = this.createAvatar(sessionID, posX, posY);
    }
    avatar.moveTo(posX, posY);
    avatar.checkFurniture(this.furnitureContainer.children);
  }

  initLocalAvatar(sessionID: string) {
    this.localAvatar = this.createAvatar(
      sessionID,
      rand(150, 450),
      rand(150, 450),
      true
    );

    // Center world container on local avatar
    this.worldContainer.position.x =
      500 / 2 - this.localAvatar.getPos().x - this.localAvatar.width / 2;
    this.worldContainer.position.y =
      500 / 2 - this.localAvatar.getPos().y - this.localAvatar.height / 2;
    if (this.onCreateUser) {
      this.onCreateUser();
    }
    this.sendData();
    this.keyListener.listenKeys();
    this.initAudioContext();
  }

  private init() {
    this.app = new PIXI.Application({
      width: 500,
      height: 500,
      backgroundColor: 0x1099bb,
      resolution: 1,
    });
    this.app.ticker.maxFPS = 30;
    // Create window frame
    let frame = new PIXI.Graphics();
    frame.beginFill(0x666666);
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
      this.onEnterBroadcast,
      this.onLeaveBroadcast
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
          console.log("found a desk!");
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
          console.log("found a broadcast spot!");
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
      onEnterVicinity = this.onEnterVicinity;
      onLeaveVicinity = this.onLeaveVicinity;
    }
    const avatar = new User(
      userID,
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

    // Update all robots
    for (let robot of this.robots) {
      robot.update();
      robot.checkFurniture(this.furnitureContainer.children);
    }

    this.localAvatar.checkUserProximity(this.usersContainer.children);
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
        if (c.physics && c.willHit(this.localAvatar, { x: newX, y: newY })) {
          return;
        }
      }
    }

    this.localAvatar.moveTo(newX, newY);

    // Center world container on local avatar
    this.worldContainer.position.x =
      500 / 2 - this.localAvatar.getPos().x - this.localAvatar.width / 2;
    this.worldContainer.position.y =
      500 / 2 - this.localAvatar.getPos().y - this.localAvatar.height / 2;

    this.sendData();
  }

  private getAvatar(id: string): User {
    return <User>this.usersContainer.getChildByName(id);
  }

  private async sendData() {
    const la = this.localAvatar;
    this.onMove(la.zoneID, la.getPos());
  }

  sendDataToParticipant(sessionID: string) {
    const la = this.localAvatar;
    this.onMove(la.zoneID, la.getPos(), sessionID);
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
