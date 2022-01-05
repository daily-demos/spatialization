import * as PIXI from "pixi.js";
import { Pos, Size } from "../worldTypes";
import { User } from "./user";

export interface ICollider {
  physics: boolean;
  willHit: (futureSize: Size, futurePos: Pos, withChildren: boolean) => boolean;
  hits: (other: ICollider) => boolean;
}

export interface IInteractable {
  tryInteract: (user: User) => void;
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
    let tb = this.getBounds(true);
    const ob = other.getBounds(true);

    return doesCollide(
      { x: tb.x, y: tb.y },
      { x: ob.x, y: ob.y },
      { width: tb.width, height: tb.height },
      { width: ob.width, height: ob.height }
    );
  }

  // Check whether the other
  willHit(futureSize: Size, futurePos: Pos, withChildren = true): boolean {
    let tp: Pos;
    let ts: Size;

    if (withChildren) {
      const thisBounds = this.getBounds(true);

      console.log("bounds", thisBounds, futurePos);
      tp = {
        x: thisBounds.x,
        y: thisBounds.y,
      };
      ts = {
        width: thisBounds.width,
        height: thisBounds.height,
      };
    } else {
      const point = this.getGlobalPosition();
      if (!point) return;
      console.log("gp", point);
      tp = {
        x: point.x,
        y: point.y,
      };
      ts = {
        width: this.width,
        height: this.height,
      };
    }
    return doesCollide(tp, futurePos, ts, futureSize);
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
