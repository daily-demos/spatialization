import * as PIXI from "pixi.js";

import { Collider } from "./collider";
import { User } from "./user";

const spotSize = 50;

export class BroadcastSpot extends Collider {
  id: number;
  name: string;
  occupantID?: string;
  onEnterBroadcast: (sessionID: string) => void;
  onLeaveBroadcast: (sessionID: string) => void;

  constructor(
    id: number,
    x: number,
    y: number,
    onEnterBroadcast: (sessionID: string) => void,
    onLeaveBroadcast: (sessionID: string) => void
  ) {
    super();

    this.id = id;
    this.name = id.toString();
    this.x = x;
    this.y = y;
    this.width = spotSize;
    this.height = spotSize;
    this.onEnterBroadcast = onEnterBroadcast;
    this.onLeaveBroadcast = onLeaveBroadcast;
    console.log("onEnterBroadcast", this.onEnterBroadcast);
    this.createTexture();
  }

  createTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = this.width;
    canvas.height = this.height;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#00FFFF";
    ctx.fillRect(0, 0, this.width, this.height);

    this.texture = PIXI.Texture.from(canvas);
  }

  tryInteract(other: User) {
    if (this.hits(other) && !this.occupantID) {
      this.occupantID = other.id;
      other.isBroadcasting = true;
      this.onEnterBroadcast(other.id);
      return;
    }
    if (other.id === this.occupantID && !this.hits(other)) {
      this.occupantID = null;
      other.isBroadcasting = false;
      this.onLeaveBroadcast(other.id);
    }
  }
}
