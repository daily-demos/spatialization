import * as PIXI from "pixi.js";

import { Pos, ZoneData } from "./worldTypes";
import { defaultWorldSize } from "./config";

export class World {
  subToTracks: (sessionID: string) => void = null;
  unsubFromTracks: (sessionID: string) => void = null;
  onMove: (pos: Pos, recipient?: string) => void = null;
  onJoinZone: (zoneData: ZoneData, recipient?: string) => void = null;
  onDataDump: (zoneData: ZoneData, posData: Pos, recipient?: string) => void =
    null;

  private app: PIXI.Application = null;
  private worldContainer: PIXI.Container = null;

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
    // and focus zones containers.
    this.worldContainer = new PIXI.Container();
    this.worldContainer.width = defaultWorldSize;
    this.worldContainer.height = defaultWorldSize;
    this.worldContainer.sortableChildren = true;

    frame.addChild(this.worldContainer);
    document.getElementById("world").appendChild(this.app.view);
  }

  updateUser(
    id: string,
    name: string,
    video: MediaStreamTrack = null,
    audio: MediaStreamTrack = null
  ) {
    console.error("updateUser() not implemented");
  }

  updateParticipantZone(
    sessionID: string,
    zoneID: number,
    spotID: number = -1
  ) {
    console.error("updateParticipantZone() not implemented");
  }

  initRemoteParticpant(sessionID: string, userName: string) {
    console.error("initRemoteParticipant() not implemented");
  }

  updateParticipantPos(sessionID: string, posX: number, posY: number) {
    console.error("updateParticipantPos() not implemented");
  }

  initLocalUser(sessionID: string, videoTrack: MediaStreamTrack): void {
    console.error("initLocalUser() not implemented");
  }

  removeUser(userId: string): void {
    console.error("removeUser() not implemented");
  }

  start() {
    console.error("start() not implemented");
  }

  sendDataDumpToParticipant(sessionID: string) {
    console.error("sendDataDumpToParticipant() not implemented");
  }

  destroy() {
    console.error("destroy() not implemented");
  }
}
