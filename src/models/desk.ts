import * as PIXI from "pixi.js";
import { Textures } from "../textures";
import { GenerateTexture } from "../worldTypes";

import { Collider } from "./collider";
import { Spot } from "./spot";
import { User } from "./user";

const spotSize = 75;
const spotBuffer = 10;
const deskDepth = 75;
const textureName = "desk";

// Desk is a location that holds spots, through which a user can
// join other users in an isolated zone.
export class Desk extends Collider {
  isPresenter = false;
  id: number;
  name: string;
  spots: Array<Spot> = [];

  constructor(id: number, numSpots: number, posX: number, posY: number) {
    super(true);

    if (this.id === 0) {
      throw new Error("ID 0 is a reserved default zone ID");
    }

    this.id = id;
    this.name = id.toString();
    this.x = posX;
    this.y = posY;
    this.setSize(numSpots);

    let px = spotBuffer;
    let py = -spotSize;
    for (let i = 0; i < numSpots; i++) {
      this.createSpot(i, px, py);
      px += spotSize + spotBuffer;
      if (px + spotSize + spotBuffer >= this.width) {
        // New line
        px = spotBuffer;
        py = this.height + 2;
      }
    }

    const t = Textures.get();
    const texture = t.library[textureName];
    if (!texture) {
      t.enqueue(
        this,
        textureName,
        (renderer: PIXI.Renderer | PIXI.AbstractRenderer): PIXI.Texture => {
          return this.generateTexture(renderer);
        }
      );
      return;
    }
    this.texture = texture;
  }

  async tryInteract(user: User) {
    for (let spot of this.spots) {
      if (!spot.occupantID && spot.hits(user)) {
        spot.occupantID = user.id;
        user.updateZone(this.id);
        break;
      }
      if (spot.occupantID === user.id && !spot.hits(user)) {
        spot.occupantID = null;
        // Global zone id is 0
        user.updateZone(0);
      }
    }
  }

  private setSize(numSpots: number) {
    const perSpot = spotSize + spotBuffer * 2;
    const spotsPerSide = Math.round(numSpots / 2);
    this.width = spotsPerSide * perSpot;
    this.height = deskDepth;
  }

  private createSpot(id: number, posX: number, posY: number) {
    const spot = new Spot(id, posX, posY, spotSize, spotSize);
    this.addChild(spot);
    this.spots.push(spot);
  }

  private generateTexture(
    renderer: PIXI.Renderer | PIXI.AbstractRenderer
  ): PIXI.Texture {
    const graphics = new PIXI.Graphics();
    graphics.beginFill(0xd48200);
    graphics.lineStyle(2, 0xf7f9fa, 1);
    graphics.drawRoundedRect(this.x, this.y, this.width, this.height, 5);
    graphics.endFill();
    const texture = renderer.generateTexture(graphics);
    return texture;
  }
}
