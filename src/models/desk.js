import * as PIXI from "pixi.js";

import { Collider } from "./collider.js";

export class Desk extends Collider {
  isPresenter = false;
  constructor(id, spots) {
    super();

    this.id = id;
    this.name = id;
    this.spots = spots;
    this.createTexture();
  }

  creatSpot() {}

  createTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = quality;
    canvas.height = 1;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FF0000";
    ctx.fillRect(20, 20, 150, 100);

    this.texture = PIXI.Texture.from(canvas);
  }
}
