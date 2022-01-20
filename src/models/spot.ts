import * as PIXI from "pixi.js";
import { DisplayObject } from "pixi.js";
import { Textures } from "../textures";
import { Pos, Size } from "../worldTypes";

import { Collider } from "./collider";

const spotTextureName = "spot";

// Spot is any location a user can interact with.
export class Spot extends Collider {
  id: number;
  name: string;
  occupantID: string;
  private staticBounds: PIXI.Rectangle;

  constructor(id: number, pos: Pos, size: Size, emoji: string = null) {
    super(false);

    this.id = id;
    this.name = id.toString();
    this.x = pos.x;
    this.y = pos.y;
    this.width = size.width;
    this.height = size.height;
    this.staticBounds = new PIXI.Rectangle(
      pos.x,
      pos.y,
      size.width,
      size.height
    );

    const t = Textures.get();

    let textureName = spotTextureName;
    if (emoji) {
      textureName += `${emoji}`;
    }
    const texture = t.catalog[textureName];
    if (!texture) {
      t.enqueue(
        this,
        textureName,
        (renderer: PIXI.Renderer | PIXI.AbstractRenderer): PIXI.Texture => {
          return this.generateTexture(renderer, emoji);
        }
      );
      return;
    }
    this.texture = texture;
    this.getBounds();
  }

  generateTexture(
    renderer: PIXI.Renderer | PIXI.AbstractRenderer,
    emoji: string = null
  ): PIXI.Texture {
    const cont = new PIXI.Container();
    cont.x = 0;
    cont.y = 0;
    cont.width = this.staticBounds.width;
    cont.height = this.staticBounds.height;

    const graphics = new PIXI.Graphics();
    graphics.beginFill(0x2b3f56, 1);
    graphics.lineStyle(2, 0xffffff, 1, 1);
    graphics.drawRoundedRect(0, 0, this.width, this.height, 8);
    graphics.endFill();
    graphics.zIndex = 1;
    cont.addChild(graphics);

    if (emoji) {
      const txt = new PIXI.Text(emoji, {
        fontFamily: "Arial",
        fontSize: 24,
        fill: 0xff1010,
        align: "center",
      });
      txt.anchor.set(0.5);
      txt.position.x = cont.x + cont.width / 2;
      txt.position.y = cont.y + cont.height / 2;
      txt.zIndex = 5;
      cont.addChild(txt);
    }

    cont.sortChildren();
    const texture = renderer.generateTexture(cont);

    return texture;
  }
}
