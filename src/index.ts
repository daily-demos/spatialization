import { Room } from "./room.js";
import { registerJoinFormListener } from "./util/nav.js";

registerJoinFormListener(initCall);

let room;

export function initCall(name: String) {
  room = new Room("https://liza.staging.daily.co/world", name, true);
  room.join();
}
