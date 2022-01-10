import * as PIXI from "pixi.js";
import { Textures } from "../textures";

import { Collider, IInteractable } from "./collider";
import { User } from "./user";

const spotSize = 75;
const textureName = "broadcast";

// BroadcastSpot is a location from which any user
// can broadcast to all other users in the world regardless
// of proximity or zone.
export class BroadcastZone extends Collider implements IInteractable {
  id: number;
  name: string;
  occupantID?: string;
  //onEnterBroadcast: (sessionID: string) => void;
  //onLeaveBroadcast: (sessionID: string) => void;

  constructor(id: number, x: number, y: number) {
    super();

    this.id = id;
    this.name = id.toString();
    this.x = x;
    this.y = y;
    this.width = spotSize;
    this.height = spotSize;

    const t = Textures.get();
    const texture = t.catalog[textureName];
    if (!texture) {
      t.enqueue(
        this,
        textureName,
        (renderer: PIXI.Renderer | PIXI.AbstractRenderer): PIXI.Texture => {
          return this.generateTexture(renderer);
        }
      );

      return;
    }
    this.texture = texture;
  }

  tryInteract(other: User) {
    if (this.hits(other) && !this.occupantID) {
      this.occupantID = other.id;
      other.media.enterBroadcast();
      other.isInVicinity = false;
      other.updateZone(this.id);

      return;
    }
    if (other.id === this.occupantID && !this.hits(other)) {
      this.occupantID = null;
      other.media.leaveBroadcast();
      other.updateZone(0);
    }
  }

  private generateTexture(
    renderer: PIXI.Renderer | PIXI.AbstractRenderer
  ): PIXI.Texture {
    const cont = new PIXI.Container();
    cont.x = 0;
    cont.y = 0;
    cont.width = this.width;
    cont.height = this.height;

    const graphics = new PIXI.Graphics();
    graphics.beginFill(0xe71115, 1);
    graphics.lineStyle(1, 0xbb0c0c, 1);

    graphics.drawRoundedRect(0, 0, this.width, this.height, 3);
    graphics.endFill();
    cont.addChild(graphics);

    const txt = new PIXI.Text("📢", {
      fontFamily: "Arial",
      fontSize: 24,
      fill: 0xff1010,
      align: "center",
    });
    txt.anchor.set(0.5);
    txt.position.x = cont.x + cont.width / 2;
    txt.position.y = cont.y + cont.height / 2;

    cont.addChild(txt);

    const texture = renderer.generateTexture(cont);
    return texture;
  }
}
