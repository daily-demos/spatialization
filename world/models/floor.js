export default class Floor extends PIXI.TilingSprite {
  constructor(width = 1000, height = 1000) {
    const texture = PIXI.Texture.from("../world/assets/floor.jpg");
    super(texture, 1000, 1000);
  }
}
