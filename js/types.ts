export type DeskID = number;
export type SpotID = number;
export type RoomID = string;
export type SessionID = string;

export type Size = {
  width: number;
  height: number;
};

export type Position = {
  x: number;
  y: number;
};

export type PositionMessage = {
  position: Position;
  deskID: DeskID;
};
