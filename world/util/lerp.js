export function lerp(start, end, delta) {
  return (1 - delta) * start + delta * end;
}

export function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
