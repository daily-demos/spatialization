import * as PIXI from "pixi.js";
import { Pos, Size } from "../worldTypes";
import { Collider, doesCollide, ICollider, IInteractable } from "./collider";
import { Desk } from "./desk";
import { Spot } from "./spot";
import { User } from "./user";

const spotSize = 75;
const spotBuffer = 10;

export class Zone extends PIXI.Container implements ICollider, IInteractable {
  isPresenter = false;
  id: number;
  name: string;
  desk: Desk;
  spots: Array<Spot> = [];
  physics = true;
  private zoneMarker: PIXI.Graphics;

  constructor(id: number, numSpots: number, pos: Pos) {
    super();

    if (this.id === 0) {
      throw new Error("ID 0 is a reserved default zone ID");
    }
    this.id = id;
    this.name = id.toString();
    this.x = pos.x;
    this.y = pos.y;

    // The position is in relation to the container, not global
    // which is why we set it to 0,0
    const l = this.getDeskLength(numSpots);
    this.desk = new Desk(id, l, { x: 0, y: 0 });
    this.desk.zIndex = 10;
    this.addChild(this.desk);

    // Generate the sittig spots associated with this zone
    let px = spotBuffer;
    let py = -spotSize;
    for (let i = 0; i < numSpots; i++) {
      this.createSpot(i, { x: px, y: py });
      px += spotSize + spotBuffer;
      if (px + spotSize + spotBuffer >= this.width) {
        // New line
        px = spotBuffer;
        py = this.desk.height + 2;
      }
    }
    this.createZoneMarker();
    this.sortableChildren = true;
    console.log("this pos: ", this.x, this.y, this.width, this.height);
  }

  public willHit(
    futureSize: Size,
    futurePos: Pos,
    withChildren = true
  ): boolean {
    const willHitDesk = this.desk.willHit(futureSize, futurePos, true);
    if (!withChildren || willHitDesk) {
      return willHitDesk;
    }
    for (let spot of this.spots) {
      if (spot.willHit(futureSize, futurePos, withChildren)) {
        return true;
      }
    }
    return false;
  }

  public hits(other: Collider): boolean {
    // For the zone, the only collision we care about is the desk.
    // Since we'll be handling spot interaction separately.
    let tb = this.desk.getBounds(true);
    let ob = other.getBounds(true);

    return doesCollide(
      { x: tb.x, y: tb.y },
      { x: ob.x, y: ob.y },
      { width: tb.width, height: tb.height },
      { width: ob.width, height: ob.height }
    );
  }

  public async tryInteract(user: User) {
    for (let spot of this.spots) {
      if (!spot.occupantID && spot.hits(user)) {
        spot.occupantID = user.id;
        user.updateZone(this.id);
        if (user.isLocal) this.zoneMarker.alpha = 0.1;
        break;
      }
      if (spot.occupantID === user.id && !spot.hits(user)) {
        spot.occupantID = null;
        // Global zone id is 0
        user.updateZone(0);
        if (user.isLocal) this.zoneMarker.alpha = 1;
      }
    }
  }

  private createZoneMarker() {
    const graphics = new PIXI.Graphics();
    graphics.beginFill(0xfddddd);
    graphics.lineStyle(2, 0xbb0c0c, 1);
    const bounds = this.getBounds(true);
    graphics.drawRoundedRect(bounds.x - 5, bounds.y - 5, bounds.width + 10, bounds.height + 10, 1);
    graphics.endFill();
    graphics.zIndex = 0;
    this.addChild(graphics);
    this.zoneMarker = graphics;
  }

  // Desk length depends on the number of spots
  // at the desk.
  private getDeskLength(numSpots: number): number {
    const perSpot = spotSize + spotBuffer * 2;
    const spotsPerSide = Math.round(numSpots / 2);
    return spotsPerSide * perSpot;
  }

  private createSpot(id: number, pos: Pos) {
    const spot = new Spot(id, pos, { width: spotSize, height: spotSize });
    spot.zIndex = 10;
    this.addChild(spot);
    this.spots.push(spot);
  }
}
