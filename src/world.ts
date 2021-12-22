import * as PIXI from "pixi.js";

import KeyListener from "./util/nav";
import { User } from "./models/user";
import { lerp, rand } from "./util/math";
import Floor from "./models/floor";
import { BroadcastSpot } from "./models/broadcast";
import { AudioContext, IAudioContext } from "standardized-audio-context";

declare global {
  interface Window {
    audioContext: IAudioContext;
  }
}

export class World {
  onEnterVicinity: (sessionID: string) => void = null;
  onLeaveVicinity: (sessionID: string) => void = null;
  onCreateUser: () => void = null;
  onMove: (zoneID: number, pos: Pos, recipient?: string) => void = null;
  onEnterBroadcast: (sessionID: string) => void = null;
  onLeaveBroadcast: (sessioID: string) => void = null;

  keyListener = new KeyListener();
  localAvatar: User = null;

  app: PIXI.Application = null;
  worldContainer: PIXI.Container = null;
  usersContainer: PIXI.Container = null;
  furnitureContainer: PIXI.Container = null;

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
      return;
    }
  }

  updateParticipantZone(sessionID: string, zoneID: number) {
    const avatar = this.getAvatar(sessionID);
    avatar.zoneID = zoneID;
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
      resolution: window.devicePixelRatio || 1,
    });
    // Create window frame
    let frame = new PIXI.Graphics();
    frame.beginFill(0x666666);
    frame.lineStyle({ color: 0xffffff, width: 4, alignment: 0 });
    frame.drawRect(0, 0, this.app.renderer.width, this.app.renderer.height);
    frame.position.set(0, 0);
    this.app.stage.addChild(frame);

    this.worldContainer = new PIXI.Container();
    this.worldContainer.width = 1000;
    this.worldContainer.height = 1000;

    const floor = new Floor();

    this.worldContainer.addChild(floor);
    frame.addChild(this.worldContainer);

    // Add container that will hold our users
    this.usersContainer = new PIXI.Container();
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

    // Create a single broadcast spot
    const spot = new BroadcastSpot(
      0,
      50,
      50,
      this.onEnterBroadcast,
      this.onLeaveBroadcast
    );
    this.furnitureContainer.addChild(spot);

    // Add furniture container to the world
    this.worldContainer.addChild(this.furnitureContainer);
  }

  private createAvatar(
    userID: string,
    x: number,
    y: number,
    isLocal = false
  ): User {
    console.log("creating avatar", userID);
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
      (onLeaveVicinity = onLeaveVicinity)
    );
    this.usersContainer.addChild(avatar);
    return avatar;
  }

  removeAvatar(userId: string) {
    const avatar = this.getAvatar(userId);
    console.log("removing avatar", avatar);
    if (!avatar) return;
    this.usersContainer.removeChild(avatar);
  }

  private draw(elapsedMS: number) {}

  private update(delta: number) {
    if (!this.localAvatar) return;

    this.localAvatar.checkUserProximity(this.usersContainer.children);

    const s = this.localAvatar.speed;
    this.keyListener.on("w", () => {
      this.localAvatar.moveY(-s);
      this.sendData();
      this.worldContainer.position.y += s;
    });

    this.keyListener.on("s", () => {
      this.localAvatar.moveY(s);
      this.sendData();
      this.worldContainer.position.y -= s;
    });

    this.keyListener.on("a", () => {
      this.localAvatar.moveX(-s);
      this.sendData();
      this.worldContainer.position.x += s;
    });

    this.keyListener.on("d", () => {
      this.localAvatar.moveX(s);
      this.sendData();
      this.worldContainer.position.x -= s;
    });
  }

  private getAvatar(id: string): User {
    return <User>this.usersContainer.getChildByName(id);
  }

  private sendData() {
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
