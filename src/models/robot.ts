import { rand } from "../util/math";
import { Pos } from "../worldTypes";
import { IZone } from "./zone";
import { User } from "./user";

export enum RobotRole {
  World = 0,
  Desk = 1,
  Broadcast = 2,
}

// Robot exists for testing purposes
export class Robot extends User {
  targetPos: Pos;
  maxCoords: Pos;
  role: RobotRole;
  persistentPos: Pos;
  reachedTargetAt: number;

  constructor(
    name: string,
    userID: string,
    maxX: number,
    maxY: number,
    role: RobotRole = RobotRole.World
  ) {
    super(name, userID, 0, 0);
    this.targetPos = { x: 0, y: 0 };
    this.maxCoords = { x: maxX, y: maxY };
    this.role = role;
    this.emoji = "🤖";
    this.gradientTextureName = "robot-gradient";
  }

  update() {
    const distance = this.distanceTo(this.targetPos);
    if (distance <= 5) {
      if (!this.reachedTargetAt) {
        this.reachedTargetAt = Date.now();
        return;
      }
      if (Date.now() - this.reachedTargetAt < 1000 * 10) {
        return;
      }
      this.pickNewTargetPos();
      this.reachedTargetAt = null;
      return;
    }
    this.stepToTarget();
  }

  // Focus zones include desks or broadcast spots.
  // This overrides the user focus zone check.
  checkFocusZones(others: Array<IZone>) {
    for (let other of others) {
      other.tryInteract(this);
    }
  }

  private pickNewTargetPos() {
    if (this.role === RobotRole.World) {
      this.targetPos = {
        x: rand(0, this.maxCoords.x),
        y: rand(0, this.maxCoords.y),
      };
      return;
    }

    if (this.distanceTo(this.persistentPos) <= 5) {
      this.targetPos = {
        x: this.x,
        y: this.targetPos.y - this.width * 3,
      };
      return;
    }
    this.targetPos = this.persistentPos;
    return;
  }

  private stepToTarget() {
    const dx = this.targetPos.x - this.x;
    const dy = this.targetPos.y - this.y;
    const angle = Math.atan2(dy, dx);

    const velX = this.speed * Math.cos(angle);
    const velY = this.speed * Math.sin(angle);

    this.x += velX;
    this.y += velY;
  }
}
