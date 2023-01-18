import * as PIXI from "pixi.js";

export type GeneratorFunc = (renderer: PIXI.Renderer) => PIXI.Texture;

type PendingGenerator = {
  sprite: PIXI.Sprite;
  textureName: string;
  generator: GeneratorFunc;
  setOnCreation: boolean;
};

// Textures is a singleton which holds all available textures,
// which should be cheaper than creating and adding more for each
// sprite. It also handles generating textures which require a
// PIXI renderer.
export class Textures {
  private static instance: Textures;

  catalog: { [key: string]: PIXI.Texture } = {};

  queue: Array<PendingGenerator> = [];

  public static get(): Textures {
    if (!Textures.instance) {
      Textures.instance = new Textures();
    }
    return Textures.instance;
  }

  public static destroy() {
    const i = Textures.get();
    Object.values(i.catalog).forEach((texture) => {
      texture.destroy(true);
    });
    i.queue = [];
    i.catalog = {};
  }

  // addTexture can be used to immediately add a texture to the library.
  // This can be used when a renderer is not required to genereate the
  // texture.
  public addTexture(textureName: string, texture: PIXI.Texture) {
    if (!this.catalog[textureName]) {
      this.catalog[textureName] = texture;
    }
  }

  // enqueue is used to queue texture generation once the app runs its update
  // and provides a renderer.
  public enqueue(
    sprite: PIXI.Sprite,
    textureName: string,
    generator: GeneratorFunc,
    setOnCreation = true
  ) {
    this.queue.push({
      textureName,
      generator,
      sprite,
      setOnCreation,
    });
  }

  // processQueue processes all queued texture generation tasks.
  public processQueue(renderer: PIXI.Renderer) {
    let next = this.queue.shift();
    while (next) {
      let texture = this.catalog[next.textureName];
      if (!texture) {
        console.log("Creating texture", next.textureName);
        texture = next.generator(renderer);
        this.catalog[next.textureName] = texture;
      }
      texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
      if (next.setOnCreation) {
        next.sprite.texture = texture;
      }
      next = this.queue.shift();
    }
  }
}
