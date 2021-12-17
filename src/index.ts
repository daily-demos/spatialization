import { Room } from "./room";
import { registerJoinFormListener } from "./util/nav";

registerJoinFormListener(initCall);

let room;

export function initCall(name: string) {
  room = new Room("https://liza.staging.daily.co/world", name, true);
  room.join();
}
