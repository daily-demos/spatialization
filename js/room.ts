import { RoomID, Position, Size, SessionID, DeskID } from "./types";
import { getSize, Desk, deskPadding } from "./desk";
import { Participant, participantPadding } from "./participant";
import { SessionState } from "http2";

const room = <HTMLElement>document.getElementById("room");
console.log("got room", room);
// Each desk should have 25px of padding around it

export function generateDefaultRoom(
  roomID: RoomID,
  sitHandler: Function
): Room {
  return generateNewRoom(roomID, 4, 4, sitHandler);
}

function generateNewRoom(
  roomID: RoomID,
  deskCount: number,
  participantsPerDesk: number,
  sitHandler: Function
): Room {
  const deskSize = getSize(participantsPerDesk);

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

  const desks = new Map<DeskID, Desk>();

  const presenterDesk = new Desk(0, 1, sitHandler, true);

  // Add the rest of the desks
  for (let i = 1; i < deskCount; i++) {
    const desk = new Desk(i, participantsPerDesk, sitHandler);
    desks.set(desk.id, desk);
  }
  const r = new Room(roomID, desks);
  r.presenterDesk = presenterDesk;
  return r;
}

export class Room {
  id: RoomID;
  presenterDesk: Desk;
  desks: Map<DeskID, Desk>;
  allParticipants: Array<Participant>;

  constructor(roomID: RoomID, desks = new Map<DeskID, Desk>()) {
    this.id = roomID;
    this.desks = desks;
    this.allParticipants = new Array<Participant>();
  }

  addParticipant(participant: Participant) {
    this.allParticipants.push(participant);
    participant.render();
  }

  updateParticipantTracks(
    sessionID: SessionID,
    vt: MediaStreamTrack,
    at: MediaStreamTrack
  ) {
    console.log("updating participant", sessionID);
    // First, check unseated participants
    for (let p of this.allParticipants) {
      if (p.sessionID === sessionID) {
        p.videoTrack = vt;
        p.audioTrack = at;
        p.render();
        return;
      }
    }
  }

  removeParticipant(sessionID: SessionID): boolean {
    for (let d of this.desks.values()) {
      if (d.tryUnseat(sessionID)) {
        return true;
      }
    }
    return false;
  }

  // temp
  seatParticipant(
    participantID: SessionID,
    deskID: DeskID,
    spotID: string
  ): boolean {
    let desk = this.desks.get(deskID);
    if (!desk) {
      this.addDesk();
      desk = this.desks.get(deskID);
    }

    for (let i = 0; i < this.allParticipants.length; i++) {
      const p = this.allParticipants[i];
      if (p.sessionID === participantID) {
        const seat = p.seat;
        if (seat) {
          this.desks.get(seat.deskID);
          desk.tryUnseat(participantID);
        }
        if (desk.trySeat(p, seat.id)) {
          return true;
        }
        return false;
      }
    }
    return false;
  }

  addDesk() {
    const lastDesk = this.desks.get(this.desks.size - 1);

    const newHeight = room.offsetHeight + lastDesk.sizePx.height + deskPadding;
    room.style.height = `${newHeight}px`;

    const desk = new Desk(lastDesk.id + 1, lastDesk.spots.size);
    this.desks.set(desk.id, desk);
  }
}
