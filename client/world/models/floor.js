export default class Floor extends PIXI.TilingSprite {
  constructor() {
    const texture = PIXI.Texture.from("../world/assets/floor.jpg");
    super(texture, 1000, 1000);
  }
}
