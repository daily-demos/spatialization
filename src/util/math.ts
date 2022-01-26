export function lerp(start: number, end: number, delta: number) {
  return (1 - delta) * start + delta * end;
}

export function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}
