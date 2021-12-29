import * as PIXI from "pixi.js";
import { Pos, Size } from "../worldTypes";

// Collider is anything that can do a hit check
// against another collider.
export class Collider extends PIXI.Sprite {
  physics: boolean;
  constructor(physics = false) {
    super();
    this.physics = physics;
  }

  hits(other: Collider): boolean {
    const tb = this.getBounds(true);
    const ob = other.getBounds(true);

    return this.doesCollide(
      { x: tb.x, y: tb.y },
      { x: ob.x, y: ob.y },
      { width: tb.width, height: tb.height },
      { width: ob.width, height: ob.height }
    );
  }

  // Check whether the other
  willHit(futureSize: Size, futurePos: Pos, withChildren = true) {
    let tp: Pos;
    let ts: Size;

    if (withChildren) {
      const thisBounds = this.getBounds(true);
      tp = {
        x: thisBounds.x,
        y: thisBounds.y,
      };
      ts = {
        width: thisBounds.width,
        height: thisBounds.height,
      };
    } else {
      tp = this.position;
      ts = {
        width: this.width,
        height: this.height,
      };
    }
    return this.doesCollide(tp, futurePos, ts, futureSize);
  }

  private doesCollide(
    thisPos: Pos,
    otherPos: Pos,
    thisSize: Size,
    otherSize: Size
  ): boolean {
    return (
      thisPos.x < otherPos.x + otherSize.width &&
      thisPos.x + thisSize.width > otherPos.x &&
      thisPos.y < otherPos.y + otherSize.height &&
      thisPos.y + thisSize.height > otherPos.y
    );
  }
}
