import { Desk, DeskID, Position, Size } from "../types";

const defaultSize: Size = {
  width: 50,
  height: 100,
};
const canvas = <HTMLCanvasElement>document.getElementById("canvas");
const ctx = canvas.getContext("2d");

export class LocalDesk implements Desk {
  id: DeskID;
  sizePx: Size;
  pos: Position;

  constructor(size = defaultSize, pos: Position) {
    this.pos = pos;
    this.sizePx = size;
    this.id = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  }

  draw() {
    ctx.fillStyle = "#FF0000";
    ctx.fillRect(this.pos.x, this.pos.y, this.sizePx.width, this.sizePx.height);
  }
}
