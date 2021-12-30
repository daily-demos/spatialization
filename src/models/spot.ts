import * as PIXI from "pixi.js";
import { GeneratorFunc, Textures } from "../textures";

import { Collider } from "./collider";

const spotTextureName = "spot";

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

    const t = Textures.get();
    const texture = t.library[spotTextureName];
    if (!texture) {
      t.enqueue(
        this,
        spotTextureName,
        (renderer: PIXI.Renderer | PIXI.AbstractRenderer): PIXI.Texture => {
          return this.generateTexture(renderer);
        }
      );
      return;
    }
    this.texture = texture;
  }

  generateTexture(
    renderer: PIXI.Renderer | PIXI.AbstractRenderer
  ): PIXI.Texture {
    const graphics = new PIXI.Graphics();
    graphics.beginFill(0xf79400);
    graphics.lineStyle(1, 0xd48200, 0.3);
    graphics.drawRoundedRect(this.x, this.y, this.width, this.height, 3);
    graphics.endFill();
    const texture = renderer.generateTexture(graphics);
    return texture;
  }
}
