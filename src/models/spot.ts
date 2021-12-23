import * as PIXI from "pixi.js";

import { Collider } from "./collider";
import { User } from "./user";

//const spotSize = 50;

export class Spot extends Collider {
  id: number;
  name: string;
  occupantID: string;

  constructor(id: number, x: number, y: number, width: number, height: number) {
    super();

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

    this.texture = PIXI.Texture.from(canvas);
  }
}
