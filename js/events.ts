import { DeskID, SpotID } from "./types";

export const localSeatedEvent = "local-participant-seated";

export function newLocalSeatedEvent(
  deskID: DeskID,
  spotID: SpotID
): CustomEvent {
  return new CustomEvent(localSeatedEvent, {
    detail: {
      deskID: deskID,
      spotID: spotID,
    },
  });
}
