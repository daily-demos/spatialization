import * as PIXI from "pixi.js";

import { Collider } from "./collider";
import { Spot } from "./spot";

export class Desk extends Collider {
  isPresenter = false;
  id: number;
  name: number;
  spots: Array<Spot>;

  constructor(id: number, spots: Array<Spot>) {
    super();

    this.id = id;
    this.name = id;
    this.spots = spots;
    this.createTexture();
  }

  creatSpot() {}

  createTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 250;
    canvas.height = 1;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FF0000";
    ctx.fillRect(20, 20, 150, 100);

    this.texture = PIXI.Texture.from(canvas);
  }
}
