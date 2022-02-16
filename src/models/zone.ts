import { ICollider } from "./collider";
import { User } from "./user";

export interface IZone extends ICollider {
  tryInteract: (user: User) => void;
  tryPlace: (user: User, spotID: number) => void;
  tryUnplace: (userID: string, spotID: number) => void;
  getID: () => number;
}
