export function lerp(start: number, end: number, delta: number) {
  return (1 - delta) * start + delta * end;
}

export function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
