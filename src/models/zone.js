import { Collider } from "./collider";
import * as PIXI from "pixi.js";
import FloorImg from "../assets/floor2.jpg";

export class Zone extends Collider {
  users = {};
  floor = null;

  constructor(posX, posY, width, height) {
    super();
    this.x = posX;
    this.y = posY;
    this.width = width;
    this.height = height;
    const texture = PIXI.Texture.from(FloorImg);
    const tilingSprite = new PIXI.TilingSprite(texture, width, height);
    this.floor = tilingSprite;
  }

  addUser(user) {
    this.users[user.userID] = user;
  }
  removeUser(userID) {
    delete this.users[userID];
  }
}
