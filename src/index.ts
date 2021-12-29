import { Room } from "./room";
import { registerJoinFormListener } from "./util/nav";

registerJoinFormListener(initCall);

let globalRoom;

export function initCall(name: string, url: string) {
  // We will do this in rooms, in case we want to implement
  // breakout rooms later. Each room will have its own call
  // object. There is one "global" room.
  globalRoom = new Room(url, name, true);
  globalRoom.join();
}
