import { Collider } from "./collider";
import * as PIXI from "pixi.js";
import FloorImg from "../assets/floor2.jpg";
import { User } from "./user";

export class Zone extends Collider {
  users: { [key: string]: User } = {};
  floor: PIXI.TilingSprite = null;

  constructor(posX: number, posY: number, width: number, height: number) {
    super();
    this.x = posX;
    this.y = posY;
    this.width = width;
    this.height = height;
    const texture = PIXI.Texture.from(FloorImg);
    const tilingSprite = new PIXI.TilingSprite(texture, width, height);
    this.floor = tilingSprite;
  }

  addUser(user: User) {
    this.users[user.id] = user;
  }
  removeUser(userID: string) {
    delete this.users[userID];
  }
}
