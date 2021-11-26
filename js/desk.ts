import {
  Participant,
  participantPadding,
  participantSize,
} from "./participant";
import { DeskID, Position, SessionID, Size } from "./types";

const defaultSpots = 4;
export const deskPadding = 55;

const room = <HTMLElement>document.getElementById("room");

export function getSize(spots: number): Size {
  const deskHeight = participantSize;
  // Each participant avatar is a 25px x 25px square.
  const deskWidth = ((participantSize + participantPadding * 2) * spots) / 2;
  return { width: deskWidth, height: deskHeight };
}

type SeatingSpot = {
  // This will be position in the desk world
  position: Position;
  participant?: Participant;
};

export class Desk {
  id: DeskID;
  sizePx: Size;
  spots: Array<SeatingSpot>;
  isPresenter: boolean;

  constructor(spotCount = defaultSpots, isPresenter = false) {
    this.sizePx = getSize(spotCount);
    this.isPresenter = isPresenter;
    if (this.isPresenter) {
      this.id = "presenter";
    } else {
      this.id = `${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)}`;
    }

    let spots = Array<SeatingSpot>();
    let deskSpotPos = {
      x: participantPadding,
      y: 0 - participantSize,
    };
    for (let i = 0; i < spotCount; i++) {
      const spot = {
        position: {
          x: deskSpotPos.x,
          y: deskSpotPos.y,
        },
      };
      let newX = deskSpotPos.x + participantSize + participantPadding;
      if (newX + participantSize + participantPadding > this.sizePx.width) {
        console.log("new row!");
        newX = participantPadding;
        deskSpotPos.y += this.sizePx.height + participantSize;
      }
      deskSpotPos.x = newX;
      spots.push(spot);
    }
    this.spots = spots;
    this.render();
  }

  trySeat(participant: Participant): boolean {
    for (let i = 0; i < this.spots.length; i++) {
      const spot = this.spots[i];
      if (!spot.participant) {
        spot.participant = participant;
        spot.participant.updateDesk(this.id, spot.position);
        return true;
      }
    }
    return false;
  }

  tryUnseat(sessionID: SessionID): boolean {
    for (let i = 0; i < this.spots.length; i++) {
      const spot = this.spots[i];
      if (spot.participant?.sessionID === sessionID) {
        spot.participant = null;
        spot.participant.remove();
        return true;
      }
    }
    return false;
  }

  private render() {
    let desk = document.getElementById(this.id);
    // See if div with this desk ID already exists
    if (!desk) {
      desk = document.createElement("div");
      desk.id = this.id;
      desk.classList.add("desk");
      if (this.isPresenter) {
        desk.classList.add("presenter");
      } else {
        desk.classList.add("normal");
        desk.style.margin = `${deskPadding}`;
      }
      desk.style.width = `${this.sizePx.width}px`;
      desk.style.height = `${this.sizePx.height}px`;
      desk.innerText = this.id;
    }
    room.appendChild(desk);
  }
}
