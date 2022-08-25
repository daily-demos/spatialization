import * as PIXI from "pixi.js";
import { Pos, Size } from "../worldTypes";

export interface ICollider {
  physics: boolean;
  hits: (other: ICollider) => boolean;
}

// Collider is anything that can do a hit check
// against another collider.
export class Collider extends PIXI.Sprite implements ICollider {
  physics: boolean;

  constructor(physics = false) {
    super();
    this.physics = physics;
  }

  hits(other: Collider): boolean {
    const tb = this.getBounds(true);
    const ob = other.getBounds(true);

    return doesCollide(
      { x: tb.x, y: tb.y },
      { x: ob.x, y: ob.y },
      { width: tb.width, height: tb.height },
      { width: ob.width, height: ob.height }
    );
  }
}

export function doesCollide(
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
