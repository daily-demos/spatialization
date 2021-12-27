import * as PIXI from "pixi.js";

import { Collider } from "./collider";
import { Spot } from "./spot";
import { User } from "./user";

const spotSize = 50;
const spotBuffer = 10;
const deskDepth = 50;

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
        px = spotBuffer;
        py = this.height;
      }
    }
    this.createTexture();
  }

  setSize(numSpots: number) {
    const perSpot = spotSize + spotBuffer * 2;
    const spotsPerSide = Math.round(numSpots / 2);
    this.width = spotsPerSide * perSpot;
    this.height = deskDepth;
  }

  createSpot(id: number, posX: number, posY: number) {
    const spot = new Spot(id, posX, posY, spotSize, spotSize);
    this.addChild(spot);
    this.spots.push(spot);
  }

  createTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = this.width;
    canvas.height = this.height;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FF0000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.texture = PIXI.Texture.from(canvas);
  }

  async tryInteract(user: User) {
    for (let spot of this.spots) {
      if (!spot.occupantID && spot.hits(user)) {
        console.log("entering spot", spot.occupantID);
        spot.occupantID = user.id;
        user.updateZone(this.id);
        break;
      }
      if (spot.occupantID === user.id && !spot.hits(user)) {
        console.log("leaving spot");
        spot.occupantID = null;
        // Global zone id is 0
        user.updateZone(0);
      }
    }
  }
}
