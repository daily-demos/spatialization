import * as PIXI from "pixi.js";

import { Collider } from "./collider";

// Spot is any location a user can interact with.
export class Spot extends Collider {
  id: number;
  name: string;
  occupantID: string;

  constructor(id: number, x: number, y: number, width: number, height: number) {
    super(false);

    this.id = id;
    this.name = id.toString();
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.createTexture();
  }

  createTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = this.width;
    canvas.height = this.height;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#00FFFF";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.font = "30px Arial";
    ctx.fillStyle = "red";
    ctx.textAlign = "center";
    ctx.fillText("Sit", canvas.width / 2, canvas.height / 2);

    this.texture = PIXI.Texture.from(canvas);
  }
}
