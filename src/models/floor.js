import * as PIXI from "pixi.js";
import FloorImg from "../assets/floor.jpg";

export default class Floor extends PIXI.TilingSprite {
  constructor(width = 1000, height = 1000) {
    const texture = PIXI.Texture.from(FloorImg);
    super(texture, 1000, 1000);
  }
}
