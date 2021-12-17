import * as PIXI from "pixi.js";

export class Collider extends PIXI.Sprite {
  constructor() {
    super();
  }

  hits(other: Collider) {
    const tb = this.getBounds();
    const ob = other.getBounds();

    return (
      tb.x < ob.x + ob.width &&
      tb.x + tb.width > ob.x &&
      tb.y < ob.y + ob.height &&
      tb.y + tb.height > ob.y
    );
  }
}
