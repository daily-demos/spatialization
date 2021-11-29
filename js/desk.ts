import { newLocalSeatedEvent } from "./events";
import {
  localParticipant,
  Participant,
  participantPadding,
  participantSize,
} from "./participant";
import {
  DeskID,
  Position,
  PositionMessage,
  SessionID,
  Size,
  SpotID,
} from "./types";

const defaultSpots = 4;
export const deskPadding = 55;

export function getSize(spots: number): Size {
  const deskHeight = participantSize;
  // Each participant avatar is a 25px x 25px square.
  const deskWidth = ((participantSize + participantPadding * 2) * spots) / 2;
  return { width: deskWidth, height: deskHeight };
}

export class SeatingSpot {
  // This will be position in the desk world
  id: SpotID;
  deskID: DeskID;
  position: Position;
  participant?: Participant;
  button?: HTMLButtonElement;
  constructor(
    id: SpotID,
    deskID: DeskID,
    position: Position,
    sitHandler: Function
  ) {
    this.id = id;
    this.deskID = deskID;
    this.position = position;
    this.createSitButton();
    this.button.addEventListener("click", (event: Event) => {
      sitHandler(event);
      this.button.style.display = "none";
    });
  }

  getDivID(): string {
    return `desk-${this.deskID}-spot-${this.id}`;
  }

  createSitButton() {
    // If there is no participant in this spot,
    // Create a button to sit in the spot
    const button = <HTMLButtonElement>document.createElement("button");
    button.innerText = "Sit";
    button.id = this.getDivID();

    const buttonWidth = 25;
    const buttonHeight = 15;
    button.style.width = `${buttonWidth}px`;
    button.style.height = `${buttonHeight}px`;

    if (this.position.y <= 0) {
      button.style.top = `${
        this.position.y + participantSize - buttonHeight
      }px`;
    } else {
      button.style.top = `${this.position.y}px`;
    }
    button.style.left = `${this.position.x}px`;

    button.style.position = "absolute";
    this.button = button;
  }
}

export class Desk {
  id: DeskID;
  sizePx: Size;
  spots: Map<SpotID, SeatingSpot>;
  isPresenter: boolean;

  constructor(
    id: DeskID,
    spotCount = defaultSpots,
    sitHandler: Function = null,
    isPresenter: boolean = false
  ) {
    this.sizePx = getSize(spotCount);
    this.isPresenter = isPresenter;
    this.id = id;
    this.spots = new Map<SpotID, SeatingSpot>();

    // Create the desk div:
    let deskDiv = document.createElement("div");
    deskDiv.id = this.id.toString();
    deskDiv.classList.add("desk");
    if (this.isPresenter) {
      deskDiv.classList.add("presenter");
    } else {
      deskDiv.classList.add("normal");
      deskDiv.style.margin = `${deskPadding}`;
    }
    deskDiv.style.width = `${this.sizePx.width}px`;
    deskDiv.style.height = `${this.sizePx.height}px`;
    deskDiv.innerText = this.id.toString();

    // Prepare all the seating spots
    let deskSpotPos = {
      x: participantPadding,
      y: 0 - participantSize,
    };

    for (let i = 0; i < spotCount; i++) {
      const newSpot = this.createSpot(
        { x: deskSpotPos.x, y: deskSpotPos.y },
        i,
        sitHandler
      );
      this.spots.set(newSpot.id, newSpot);
      deskDiv.appendChild(newSpot.button);
      let newX = deskSpotPos.x + participantSize + participantPadding;
      if (newX + participantSize + participantPadding > this.sizePx.width) {
        newX = participantPadding;
        deskSpotPos.y += this.sizePx.height + participantSize;
      }
      deskSpotPos.x = newX;
    }
    const roomDiv = <HTMLElement>document.getElementById("room");
    roomDiv.appendChild(deskDiv);
  }

  private createSpot(
    deskSpotPos: Position,
    i: number,
    sitHandler: Function
  ): SeatingSpot {
    const spot = new SeatingSpot(i, this.id, deskSpotPos, (event: Event) => {
      const target = <HTMLButtonElement>event.target;
      if (this.trySeat(localParticipant, spot.id)) {
        sitHandler(this.id, target.id);
      }
    });

    return spot;
  }
  trySeat(participant: Participant, spotID: SpotID): boolean {
    // Unseat first
    this.tryUnseat(participant.sessionID);

    // Now seat
    console.log("seating participant: ", participant);
    const spot = this.spots.get(spotID);
    if (spot && !spot.participant) {
      spot.participant = participant;
      console.log("spot position:", spot.position);
      spot.participant.updateDesk(spot);
      window.dispatchEvent(newLocalSeatedEvent(this.id, spotID));
      return true;
    }
    return false;
  }

  tryUnseat(sessionID: SessionID): boolean {
    for (let kv of this.spots.entries()) {
      let id = kv[0];
      let spot = kv[1];
      if (spot.participant?.sessionID === sessionID) {
        spot.participant.remove();
        spot.participant = null;
        console.log("creating sit button");
        spot.button.style.display = "inline-block";
        return true;
      }
    }

    return false;
  }
}
