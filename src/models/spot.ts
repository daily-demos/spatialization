import * as PIXI from "pixi.js";
import { Textures } from "../textures";
import { Pos, Size } from "../worldTypes";

import { Collider } from "./collider";

const spotTextureName = "spot";

// Spot is any location a user can interact with.
export class Spot extends Collider {
  id: number;
  name: string;
  occupantID: string;

  constructor(id: number, pos: Pos, size: Size) {
    super(false);

    this.id = id;
    this.name = id.toString();
    this.x = pos.x;
    this.y = pos.y;
    this.width = size.width;
    this.height = size.height;

    const t = Textures.get();
    const texture = t.catalog[spotTextureName];
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
    this.getBounds();
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
    graphics.beginFill(0x2b3f56, 1);
    graphics.lineStyle(1, 0xffffff, 1, 1);

    graphics.drawRoundedRect(0, 0, this.width, this.height, 3);
    graphics.endFill();
    cont.addChild(graphics);

    /*  const txt = new PIXI.Text("🪑", {
      fontFamily: "Arial",
      fontSize: 24,
      fill: 0xff1010,
      align: "center",
    });
    txt.anchor.set(0.5);
    txt.position.x = cont.x + cont.width / 2;
    txt.position.y = cont.y + cont.height / 2;

    cont.addChild(txt); */

    const texture = renderer.generateTexture(cont);
    return texture;
  }

  // https://github.com/pixijs/pixijs/issues/1333
  private drawDashLine = function (
    graphics: PIXI.Graphics,
    rect: PIXI.Rectangle,
    dash = 16,
    gap = 8
  ) {
    const lastPosition = graphics.currentPath.points;
    const currentPosition = {
      x: lastPosition[lastPosition.length - 2] || 0,
      y: lastPosition[lastPosition.length - 1] || 0,
    };

    const points = [
      {
        x: Math.abs(rect.x + rect.width),
        y: Math.abs(rect.y),
      },
      {
        x: Math.abs(rect.x + rect.width),
        y: Math.abs(rect.y + rect.height),
      },
      {
        x: Math.abs(rect.x),
        y: Math.abs(rect.y + rect.height),
      },
      {
        x: Math.abs(rect.x),
        y: Math.abs(rect.y),
      },
    ];

    for (const to of points) {
      for (
        ;
        Math.abs(currentPosition.x) < to.x ||
        Math.abs(currentPosition.y) < to.y;

      ) {
        currentPosition.x =
          Math.abs(currentPosition.x + dash) < to.x
            ? currentPosition.x + dash
            : to.x;
        currentPosition.y =
          Math.abs(currentPosition.y + dash) < to.y
            ? currentPosition.y + dash
            : to.y;

        graphics.lineTo(currentPosition.x, currentPosition.y);

        currentPosition.x =
          Math.abs(currentPosition.x + gap) < to.x
            ? currentPosition.x + gap
            : to.x;
        currentPosition.y =
          Math.abs(currentPosition.y + gap) < to.y
            ? currentPosition.y + gap
            : to.y;

        graphics.moveTo(currentPosition.x, currentPosition.y);
      }
    }
  };
}
