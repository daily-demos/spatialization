import * as PIXI from "pixi.js";
import { Texture } from "pixi.js";

export type GeneratorFunc = (
  renderer: PIXI.Renderer | PIXI.AbstractRenderer
) => PIXI.Texture;

type PendingGenerator = {
  sprite: PIXI.Sprite;
  textureName: string;
  generator: GeneratorFunc;
  setOnCreation: boolean;
};

export class Textures {
  private static instance: Textures;

  library: { [key: string]: PIXI.Texture } = {};
  queue: Array<PendingGenerator> = [];

  private constructor() {}

  public static get(): Textures {
    if (!Textures.instance) {
      Textures.instance = new Textures();
    }
    return Textures.instance;
  }

  public static destroy() {
      const i = Textures.get();
      i.queue = [];
      i.library = {};
  }

  // addTexture can be used to immediately add a texture to the library.
  public addTexture(textureName: string, texture: PIXI.Texture) {
    if (!this.library[textureName]) {
      this.library[textureName] = texture;
    }
  }

  // enqueue is used to queue texture generatoin once the app runs its update
  // and providees a renderer.
  public enqueue(
    sprite: PIXI.Sprite,
    textureName: string,
    generator: GeneratorFunc,
    setOnCreation = true
  ) {
    this.queue.push({
      textureName: textureName,
      generator: generator,
      sprite: sprite,
      setOnCreation: setOnCreation,
    });
  }

  // processQueue processes all queued texture generation tasks.
  public processQueue(renderer: PIXI.Renderer | PIXI.AbstractRenderer) {
    let next = this.queue.shift();
    while (next) {
      let texture = this.library[next.textureName];
      if (!texture) {
        console.log("Creating texture", next.textureName);
        texture = next.generator(renderer);
        this.library[next.textureName] = texture;
      }
      texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
      if (next.setOnCreation) {
        next.sprite.texture = texture;
      }
      next = this.queue.shift();
    }
  }
}
