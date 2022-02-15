import * as PIXI from "pixi.js";
import { globalZoneID, standardTileSize } from "../config";
import { Pos } from "../worldTypes";
import { Collider, doesCollide } from "./collider";
import { Desk } from "./desk";
import { Spot } from "./spot";
import { User } from "./user";
import { IZone } from "./zone";

const spotSize = standardTileSize;
const spotBuffer = 20;

// DeskZone is a location that holds spots, through which a user can
// join other users in an isolated zone.
export class DeskZone extends PIXI.Container implements IZone {
  physics = true;

  private id: number;
  private desk: Desk;
  private spots: Array<Spot> = [];
  private freeSeats: number;
  private staticBounds: PIXI.Rectangle;
  private zoneMarker: PIXI.Graphics;
  private labelGraphics: PIXI.Text;

  constructor(id: number, name: string, numSpots: number, pos: Pos) {
    super();

    if (id === globalZoneID) {
      throw new Error(`ID ${id} is a reserved default zone ID`);
    }
    this.id = id;
    this.name = name;
    this.x = pos.x;
    this.y = pos.y;
    this.freeSeats = numSpots;

    const deskLength = this.getDeskLength(numSpots);

    // The position is in relation to the container, not global
    // which is why we set it to 0,0
    this.desk = new Desk(id, deskLength, { x: 0, y: 0 });
    this.desk.zIndex = 10;
    this.addChild(this.desk);

    // Generate the sitting spots associated with this zone
    let px = spotBuffer;
    let py = -spotSize - spotBuffer;
    for (let i = 0; i < numSpots; i++) {
      this.createSpot(i, { x: px, y: py });
      px += spotSize + spotBuffer;
      if (px + spotSize + spotBuffer > this.desk.width) {
        // New line
        px = spotBuffer;
        py = this.desk.height + spotBuffer;
      }
    }

    // We create this because PIXI Bounds are subject to change, and likely will as child
    // textures may be generated post-construction. The position here is relative to the
    // container.
    const deskSize = this.desk.staticSize;
    this.staticBounds = new PIXI.Rectangle(
      0,
      0 - spotSize - spotBuffer,
      deskSize.width,
      deskSize.height + (spotSize + spotBuffer) * 2
    );

    this.createZoneMarker();
    this.createLabel();
    this.sortableChildren = true;
  }

  public getID(): number {
    return this.id;
  }

  public getSpots(): Array<Spot> {
    return this.spots;
  }

  public tryPlace(user: User, spotID: number) {
    for (let spot of this.spots) {
      if (spot.id === spotID && !spot.occupantID) {
        spot.occupantID = user.id;
        this.freeSeats--;
        const np = {
          x: this.x + spot.x,
          y: this.y + spot.y,
        };
        user.moveTo(np);
        this.updateLabel();
        return;
      }
    }
  }

  public tryUnplace(userID: string, spotID: number) {
    for (let spot of this.spots) {
      if (spot.id === spotID && spot.occupantID === userID) {
        spot.occupantID = null;
        this.freeSeats++;
        this.updateLabel();
        return;
      }
    }
  }

  public moveTo(pos: Pos) {
    this.x = pos.x;
    this.y = pos.y;
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

  public hitsSpot(other: Collider): boolean {
    for (let spot of this.spots) {
      if (spot.hits(other)) {
        return true;
      }
    }
    return false;
  }

  public async tryInteract(user: User) {
    let hadPriorSpot: boolean;
    let hasNewSpot: boolean;
    const oldFreeSeats = this.freeSeats;

    for (let spot of this.spots) {
      // If the user is already registered in this spot...
      if (spot.occupantID === user.id) {
        // ...and is still in the spot, do nothing
        if (spot.hits(user) && !hasNewSpot) return;
        // User is no longer in the spot - clear the spot
        spot.occupantID = null;
        hadPriorSpot = true;
        continue;
      }

      // If this spot has no occupant but the user
      // hits it, occupy it.
      if (!spot.occupantID && spot.hits(user)) {
        spot.occupantID = user.id;
        user.updateZone(this.id, spot.id);
        hasNewSpot = true;
        if (user.isLocal) this.hideZoneMarker();
        continue;
      }
    }

    // If the user has just left a spot and has not
    // joined a new one, go back to the global zone.
    if (hadPriorSpot && !hasNewSpot) {
      this.freeSeats++;
      user.updateZone(globalZoneID);
      if (user.isLocal) this.showZoneMarker();
    } else if (!hadPriorSpot && hasNewSpot) {
      this.freeSeats--;
    }

    // Update the label text if needed.
    if (oldFreeSeats !== this.freeSeats) {
      this.updateLabel();
    }
  }

  private createLabel() {
    const bounds = this.staticBounds;

    const t = this.getLabelTxt();
    const txt = new PIXI.Text(t, {
      fontFamily: "Arial",
      fontSize: 16,
      fill: 0xffffff,
      align: "center",
    });
    txt.anchor.set(0.5);
    txt.position.x = bounds.x + bounds.width / 2;
    txt.position.y = bounds.y - 25;

    this.addChild(txt);
    this.labelGraphics = txt;
  }

  private updateLabel() {
    const t = this.getLabelTxt();
    this.labelGraphics.text = t;
  }

  private getLabelTxt(): string {
    return `Room ${this.name} (${this.freeSeats}/${this.spots.length} seats available)`;
  }
  private hideZoneMarker() {
    this.zoneMarker.alpha = 0.1;
  }

  private showZoneMarker() {
    this.zoneMarker.alpha = 1;
  }

  private createZoneMarker() {
    const graphics = new PIXI.Graphics();
    graphics.lineStyle(2, 0x1bebb9, 1);
    const bounds = this.staticBounds;
    graphics.drawRoundedRect(
      bounds.x - 10,
      bounds.y - 10,
      bounds.width + 20,
      bounds.height + 20,
      8
    );
    graphics.endFill();

    graphics.zIndex = 0;
    this.addChild(graphics);
    this.zoneMarker = graphics;
  }

  // Desk length depends on the number of spots
  // at the desk.
  private getDeskLength(numSpots: number): number {
    const spotsPerSide = Math.round(numSpots / 2);
    return spotBuffer + spotsPerSide * (spotSize + spotBuffer);
  }

  private createSpot(id: number, pos: Pos) {
    const spot = new Spot(id, pos, { width: spotSize, height: spotSize });
    spot.zIndex = 10;
    this.addChild(spot);
    this.spots.push(spot);
  }
}
