import * as PIXI from "pixi.js";
import { Textures } from "../textures";
import { Pos, Size } from "../worldTypes";

import { Collider } from "./collider";

const deskDepth = 58;
const deskTextureName = "desk";

// Desk is part of a DeskZone which the user is unable to
// walk through. Spots are positioned around it.
export class Desk extends Collider {
  isPresenter = false;
  id: number;
  name: string;
  staticSize: Size;

  constructor(id: number, length: number, pos: Pos) {
    super(true);

    if (this.id === 0) {
      throw new Error("ID 0 is a reserved default zone ID");
    }

    this.id = id;
    this.name = id.toString();
    this.x = pos.x;
    this.y = pos.y;
    this.width = length;
    this.height = deskDepth;

    this.staticSize = { width: length, height: deskDepth };

    const t = Textures.get();
    const texture = t.catalog[deskTextureName];

    if (!texture) {
      t.enqueue(
        this,
        deskTextureName,
        (renderer: PIXI.Renderer | PIXI.AbstractRenderer): PIXI.Texture => {
          return this.generateTexture(renderer);
        }
      );
      return;
    }
    this.texture = texture;
    this.getBounds();
  }

  private generateTexture(
    renderer: PIXI.Renderer | PIXI.AbstractRenderer
  ): PIXI.Texture {
    const graphics = new PIXI.Graphics();
    graphics.beginFill(0x2b3f56);
    //   graphics.lineStyle(10, 0x121a24, 1);
    graphics.drawRoundedRect(this.x, this.y, this.width, this.height, 5);
    graphics.endFill();
    const texture = renderer.generateTexture(graphics);
    return texture;
  }
}
