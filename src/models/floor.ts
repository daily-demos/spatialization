import * as PIXI from "pixi.js";
import { Textures } from "../textures";

const textureName = "floorTile";

export default class Floor extends PIXI.TilingSprite {
  constructor(width = 1000, height = 1000) {
    super(null, width, height);

    const t = Textures.get();
    const texture = t.catalog[textureName];
    if (!texture) {
      t.enqueue(
        this,
        textureName,
        (renderer: PIXI.Renderer): PIXI.Texture =>
          this.generateTexture(renderer)
      );
      return;
    }
    this.texture = texture;
  }

  generateTexture(renderer: PIXI.Renderer): PIXI.Texture {
    const graphics = new PIXI.Graphics();
    graphics.beginFill(0x121a24);
    graphics.lineStyle(1, 0xfffff, 0.1);
    graphics.drawRect(this.x, this.y, 50, 50);
    graphics.endFill();
    const texture = renderer.generateTexture(graphics);
    return texture;
  }
}
