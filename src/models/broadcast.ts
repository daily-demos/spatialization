import * as PIXI from "pixi.js";

import { Collider } from "./collider";
import { User } from "./user";

const spotSize = 50;

// BroadcastSpot is a location from which any user
// can broadcast to all other users in the world regardless
// of proximity or zone.
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
    this.createTexture();
  }

  createTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = this.width;
    canvas.height = this.height;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#00FFFF";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.font = "10px Arial";
    ctx.fillStyle = "red";
    ctx.textAlign = "center";
    ctx.fillText("Broadcast", canvas.width / 2, canvas.height / 2);

    this.texture = PIXI.Texture.from(canvas);
  }

  tryInteract(other: User) {
    if (this.hits(other) && !this.occupantID) {
      console.log("entering broadcast", other.id);
      this.occupantID = other.id;
      other.media.enterBroadcast();
      if (this.onEnterBroadcast) this.onEnterBroadcast(other.id);
      return;
    }
    if (other.id === this.occupantID && !this.hits(other)) {
      this.occupantID = null;
      console.log("leaving browscast");
      other.media.leaveBroadcast();
      if (this.onLeaveBroadcast) this.onLeaveBroadcast(other.id);
    }
  }
}
