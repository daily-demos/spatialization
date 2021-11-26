import { RoomID, Position, Size, SessionID } from "./types";
import { getSize, Desk, deskPadding } from "./desk";
import { Participant, participantPadding } from "./participant";

const room = <HTMLElement>document.getElementById("room");
console.log("got room", room);
// Each desk should have 25px of padding around it

export function generateDefaultRoom(roomID: RoomID): Room {
  return generateNewRoom(roomID, 4, 4);
}

function generateNewRoom(
  roomID: RoomID,
  deskCount: number,
  participantsPerDesk: number
): Room {
  const deskSize = getSize(participantsPerDesk);

  // What dimensions does the canvas need to be to fit the
  // requested desk count and dimensions?

  // How many desks we have per row depends on the available screen space
  const desksPerRow = Math.floor(
    room.offsetWidth / (deskSize.width + deskPadding * 2)
  );
  const rows = Math.round(deskCount / desksPerRow);
  // For the height, allow enough space for a "presentation" desk at the top of the canvas
  const cHeight =
    rows * (deskSize.height + deskPadding * 2) +
    (deskSize.height + deskPadding * 2);
  room.style.height = `${cHeight}px`;

  const desks = [];

  const presenterDesk = new Desk(1, true);

  // Add the rest of the desks
  for (let i = 1; i < deskCount; i++) {
    const desk = new Desk(participantsPerDesk);
    desks.push(desk);
  }
  const r = new Room(roomID, desks);
  r.presenterDesk = presenterDesk;
  return r;
}

export class Room {
  id: RoomID;
  presenterDesk: Desk;
  desks: Array<Desk>;

  constructor(roomID: RoomID, desks: Array<Desk> = new Array<Desk>()) {
    this.id = roomID;
    this.desks = desks;
  }

  addParticipant(participant: Participant) {
    this.seatParticipant(participant);
  }

  updateParticipantTracks(
    sessionID: SessionID,
    vt: MediaStreamTrack,
    at: MediaStreamTrack
  ) {
    console.log("updating participant", sessionID);
    // First, check unseated participants
    for (let i = 0; i < this.desks.length; i++) {
      const d = this.desks[i];
      for (let n = 0; n < d.spots.length; n++) {
        const s = d.spots[n];

        if (s.participant?.sessionID === sessionID) {
          console.log("found matching session", vt, at);
          const p = s.participant;
          p.videoTrack = vt;
          p.audioTrack = at;
          p.render();
        }
      }
    }
  }

  removeParticipant(sessionID: SessionID) {
    for (let i = 0; i < this.desks.length; i++) {
      const d = this.desks[i];
      d.tryUnseat(sessionID);
    }
  }

  seatParticipant(p: Participant) {
    // TODO: are JS arrays ordered? We probably want to seat oldest unseated
    // participants first, hence not iterating backwards
    for (let n = 0; n < this.desks.length; n++) {
      const d = this.desks[n];
      if (d.trySeat(p)) {
        return;
      }
    }

    // Time to add another desk
    this.addDesk();
    this.seatParticipant(p);
  }

  addDesk() {
    const lastDesk = this.desks[this.desks.length - 1];

    const newHeight = room.offsetHeight + lastDesk.sizePx.height + deskPadding;
    room.style.height = `${newHeight}px`;

    const desk = new Desk(lastDesk.spots.length);
    this.desks.push(desk);
  }
}
