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
    const cont = new PIXI.Container();
    cont.x = 0;
    cont.y = 0;
    cont.width = this.width;
    cont.height = this.height;

    const graphics = new PIXI.Graphics();
    graphics.beginFill(0xf79400, 1);
    graphics.lineStyle(1, 0xd48200, 1);

    graphics.drawRoundedRect(0, 0, this.width, this.height, 3);
    graphics.endFill();
    cont.addChild(graphics);

    const txt = new PIXI.Text("🪑", {
      fontFamily: "Arial",
      fontSize: 24,
      fill: 0xff1010,
      align: "center",
    });
    txt.anchor.set(0.5);
    txt.position.x = cont.x + cont.width / 2;
    txt.position.y = cont.y + cont.height / 2;

    cont.addChild(txt);

    const texture = renderer.generateTexture(cont);
    return texture;
  }
}
