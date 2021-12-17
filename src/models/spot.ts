import * as PIXI from "pixi.js";

import { Collider } from "./collider";

const spotSize = 50;

export class Spot extends Collider {
  id: number;
  name: number;

  constructor(id: number, x: number, y: number) {
    super();

    this.id = id;
    this.name = id;
    this.x = x;
    this.y = y;
    this.width = spotSize;
    this.height = spotSize;
    this.createTexture();
  }

  createTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 250;
    canvas.height = 1;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#00FFFF";
    ctx.fillRect(0, 0, this.width, this.height);

    this.texture = PIXI.Texture.from(canvas);
  }
}
