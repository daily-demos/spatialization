import { IRoom, RoomID, Participant, SessionID } from "../types";
import { Mutex } from "async-mutex";
import { resourceLimits } from "worker_threads";

const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 60 * 60 * 3 });

const lock = new Mutex();

export async function storeRoom(room: IRoom) {
  await lock.runExclusive(() => {
    cache.set(room.id, room);
  });
}

export async function getRoom(roomID: RoomID): Promise<IRoom> {
  return await lock.runExclusive(() => {
    return cache.get(roomID);
  });
}

export async function storeParticipant(
  roomID: RoomID,
  participant: Participant
) {
  const room = await getRoom(roomID);
  if (!room.participants) {
    room.participants = new Set<Participant>();
  }
  room.participants.add(participant);
  await storeRoom(room);
}

export async function removeParticipant(roomID: RoomID, sessionID: SessionID) {
  const room = await getRoom(roomID);
  // Find relevant participant and delete it
  room.participants.forEach((p) => {
    if (p.sessionID === sessionID) {
      room.participants.delete(p);
      return;
    }
  });
  await storeRoom(room);
}
