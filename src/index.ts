import { Room } from "./room";
import { registerJoinFormListener } from "./util/nav";

registerJoinFormListener(initCall);

let room;

export function initCall(name: string, url: string) {
  room = new Room(url, name, true);
  room.join();
}
