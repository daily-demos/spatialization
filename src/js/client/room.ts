import { port } from "../env";
import { IRoom, Participant, RoomID, Position, Size, SessionID } from "../types";
import { LocalDesk } from "./desk";

const fps = 30;
const canvas = <HTMLCanvasElement>document.getElementById("canvas");

function generateNewRoom(
  roomID: RoomID,
  deskCount: number,
  deskWidth: number,
  deskHeight: number
): LocalRoom {
  // Each desk should have 25px of padding around it
  const deskPadding = 25;
  const desksPerRow = 4;

  // What dimensions does the canvas need to be to fit the
  // requested desk count and dimensions?
  if (deskCount > desksPerRow) {
    const cWidth = desksPerRow * (deskWidth + deskPadding * 2);
    canvas.width = cWidth;

    const rows = Math.round(deskCount / 4);
    // For the height, allow enough space for a "presentation" desk at the top of the canvas
    const cHeight =
      rows * (deskHeight + deskPadding * 2) + (deskHeight + deskPadding * 2);
    canvas.height = cHeight;
  }

  const desks = [];
  // Add the first desk: the presentation desk
  let pos: Position = {
    x: canvas.width - deskWidth / 2,
    y: deskPadding,
  };
  const size: Size = {
    width: deskWidth,
    height: deskHeight,
  };
  const desk = new LocalDesk(size, pos);
  desks.push(desk);

  pos.x = deskPadding;
  pos.y = desks[desks.length - 1].sizePx.height + deskPadding * 2;

  // Add the rest of the desks
  for (let i = 1; i < deskCount; i++) {
    if (i % desksPerRow) {
      // Next row!
      pos.y += deskHeight + deskPadding * 2;
      pos.x = deskPadding;
    }
    const desk = new LocalDesk(size, pos);
    pos.x += deskWidth + deskPadding * 2;
    desks.push(desk);
  }
  return new LocalRoom(roomID, new Set<LocalDesk>(desks), null);
}

export async function getRoom(roomID : RoomID) : Promise<LocalRoom> {
  const url =  `localhost:${port}/rooms/${roomID}`
  const res = await fetch( url );
  if (res.status === 200) {
    const json = await res.json();
    return <LocalRoom>json;
  } else {
    console.error("unexpected status code", res.status);
  }
  return null;
}

export class LocalRoom implements IRoom {
  id: RoomID;
  desks: Set<LocalDesk>;
  participants: Set<Participant>;

  constructor(
    roomID: RoomID,
    desks: Set<LocalDesk>,
    participants: Set<Participant>
  ) {
    this.id = roomID;
    this.desks = desks;
    this.participants = participants;
  }

  start() {
    this.draw();
  }

  draw() {
    setTimeout(function () {
      requestAnimationFrame(this.draw);
      for (let i = 0; i < this.desks; i++) {
        const desk = this.desks[i];
        desk.draw();
      }
    }, 1000 / fps);
  }
}
