import { Collider } from "../collider";

describe("Collider hit tests", () => {
  test("Identical position", () => {
    const s1 = new Sprite(10, 10, 0, 0);
    const s2 = new Sprite(10, 10, 0, 0);
    expect(s1.hits(s2)).toBe(true);
  });
  test("Offset to the left", () => {
    const s1 = new Sprite(10, 10, -9, 0);
    const s2 = new Sprite(10, 10, 0, 0);
    expect(s1.hits(s2)).toBe(true);
  });
  test("Offset to the right", () => {
    const s1 = new Sprite(10, 10, 9, 0);
    const s2 = new Sprite(10, 10, 0, 0);
    expect(s1.hits(s2)).toBe(true);
  });
  test("Offset diagonally to the right", () => {
    const s1 = new Sprite(10, 10, 5, 5);
    const s2 = new Sprite(10, 10, 0, 0);
    expect(s1.hits(s2)).toBe(true);
  });
  test("Not touching", () => {
    const s1 = new Sprite(10, 10, 0, 15);
    const s2 = new Sprite(10, 10, 0, 0);

    expect(s1.hits(s2)).toBe(false);
  });
});

class Sprite extends Collider {
  constructor(width: number, height: number, x: number, y: number) {
    super();
    this.width = width;
    this.height = height;
    this.x = x;
    this.y = y;
    this.getBounds();
  }
}
