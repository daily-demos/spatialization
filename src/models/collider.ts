import * as PIXI from "pixi.js";

export class Collider extends PIXI.Sprite {
  physics: boolean;
  constructor(physics = false) {
    super();
    this.physics = physics;
  }

  hits(other: Collider): boolean {
    const tp = this.getGlobalPosition();
    const op = other.getGlobalPosition();

    return (
      tp.x < op.x + other.width &&
      tp.x + this.width > op.x &&
      tp.y < op.y + other.height &&
      tp.y + this.height > op.y
    );
  }

  willHit(other: Collider, futurePos: Pos) {
    const fx = futurePos.x;
    const fy = futurePos.y;

    const tp = this.position;

    return (
      tp.x < fx + other.width &&
      tp.x + this.width > fx &&
      tp.y < fy + other.height &&
      tp.y + this.height > fy
    );
  }

  /*   if (!this.physics || !colliding) return colliding;

    // If we want the other object to react with this one,
    // we need to check which direction we're colliding from:

    // Get center point of each object
    const tbx = (this.x + tb.width) / 2;
    const tby = (this.y + tb.height) / 2;

    const obx = (other.x + ob.width) / 2;
    const oby = (other.y + ob.height) / 2;

    // Bounce object back in closest direction
    if (obx < tbx) {
      other.x = this.x - 5;
    } else {
      other.x = this.x + tb.width + 5;
    }

    if (oby < tby) {
      other.y = this.y - ob.height - 5;
    } else {
      other.y = this.y + 5;
    }

  } */
}
