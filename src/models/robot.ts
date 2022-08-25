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
    userID: string,
    maxX: number,
    maxY: number,
    role: RobotRole = RobotRole.World
  ) {
    const args = {
      id: userID,
      userName: userID,
      x: 0,
      y: 0,
      emoji: "🤖",
      gradientTextureName: "robot-gradient",
    };
    super(args);
    this.targetPos = { x: 0, y: 0 };
    this.maxCoords = { x: maxX, y: maxY };
    this.role = role;
  }

  update() {
    const distance = this.distanceTo(this.targetPos);
    if (distance > 5) {
      this.stepToTarget();
      return;
    }
    if (!this.reachedTargetAt) {
      this.reachedTargetAt = Date.now();
      return;
    }
    if (Date.now() - this.reachedTargetAt < 1000 * 10) {
      return;
    }
    this.pickNewTargetPos();
    this.reachedTargetAt = null;
  }

  // Focus zones include desks or broadcast spots.
  // This overrides the user focus zone check.
  checkFocusZones(others: Array<IZone>) {
    for (let i = 0; i < others.length; i += 1) {
      const other = others[i];
      other.tryInteract(this);
    }
  }

  private pickNewTargetPos() {
    if (this.role === RobotRole.World) {
      // In the world role, pick any random spot in the world
      this.targetPos = {
        x: rand(0, this.maxCoords.x),
        y: rand(0, this.maxCoords.y),
      };
      return;
    }

    // If not in world role, toggle target between persistent
    // position and a spot just above it
    if (this.distanceTo(this.persistentPos) <= 5) {
      this.targetPos = {
        x: this.x,
        y: this.targetPos.y - this.width * 3,
      };
      return;
    }
    this.targetPos = this.persistentPos;
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
