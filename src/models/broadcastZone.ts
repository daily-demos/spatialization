import * as PIXI from "pixi.js";
import { globalZoneID, standardTileSize } from "../config";
import { Pos } from "../worldTypes";

import { Collider, doesCollide } from "./collider";
import { Spot } from "./spot";
import { User } from "./user";
import { IZone } from "./zone";

const spotSize = standardTileSize;

// BroadcastZone is a location from which any user
// can broadcast to all other users in the world regardless
// of proximity or zone.
export class BroadcastZone extends PIXI.Container implements IZone {
  name: string;
  physics: false;

  private id: number;
  private spot: Spot;

  constructor(id: number, x: number, y: number) {
    super();

    this.id = id;
    this.name = id.toString();
    this.x = x;
    this.y = y;

    // The position is in relation to the container, not global
    // which is why we set it to 0,0
    this.spot = new Spot(
      0,
      { x: 0, y: 0 },
      { width: spotSize, height: spotSize },
      "📣"
    );
    this.addChild(this.spot);
    this.createLabel();
    this.sortableChildren = true;
  }

  public getID(): number {
    return this.id;
  }

  public moveTo(pos: Pos) {
    this.x = pos.x;
    this.y = pos.y;
  }

  public tryPlace(user: User, spotID: number) {
    if (!this.spot.occupantID) {
      this.spot.occupantID = user.id;
      const np = {
        x: this.x + this.spot.x,
        y: this.y + this.spot.y,
      };
      user.moveTo(np);
    }
  }

  public tryUnplace(userID: string, spotID: number = -1) {
    if (this.spot.occupantID === userID) {
      this.spot.occupantID = null;
    }
  }

  public hits(other: Collider): boolean {
    // For the zone, the only collision we care about is the spot.
    let tb = this.spot.getBounds(true);
    let ob = other.getBounds(true);

    return doesCollide(
      { x: tb.x, y: tb.y },
      { x: ob.x, y: ob.y },
      { width: tb.width, height: tb.height },
      { width: ob.width, height: ob.height }
    );
  }

  public tryInteract(other: User) {
    if (this.hits(other) && !this.spot.occupantID) {
      this.spot.occupantID = other.id;
      other.updateZone(this.id);
      return;
    }
    if (other.id === this.spot.occupantID && !this.hits(other)) {
      this.spot.occupantID = null;
      other.updateZone(globalZoneID);
    }
  }

  private createLabel() {
    const txt = new PIXI.Text("Broadcast to all", {
      fontFamily: "Arial",
      fontSize: 16,
      fill: 0xffffff,
      align: "center",
    });
    txt.anchor.set(0.5);
    txt.position.x = spotSize / 2;
    txt.position.y = 0 - 20;
    this.addChild(txt);
  }
}
