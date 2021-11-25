export type DeskID = number;
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

export type Desk = {
  id: DeskID;
  sizePx: Size;
};

export type Participant = {
  sessionID: SessionID;
  positionPx: Position;
  deskID: DeskID;
};

export interface IRoom {
  id: RoomID;
  desks: Set<Desk>;
  participants: Set<Participant>;
}
