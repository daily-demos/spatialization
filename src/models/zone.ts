import * as PIXI from "pixi.js";
import { ICollider } from "./collider";

export interface IZone extends ICollider {
  tryInteract: (user: PIXI.Sprite) => void;
  tryPlace: (user: PIXI.Sprite, spotID: number) => void;
  tryUnplace: (userID: string, spotID: number) => void;
  getID: () => number;
}
