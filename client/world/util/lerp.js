export function lerp (start, end, delta){
    return (1 - delta) * start + delta * end;
  }