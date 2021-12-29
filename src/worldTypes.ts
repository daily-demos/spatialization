import * as PIXI from "pixi.js";

export type Pos = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export type GenerateTexture = (
  displayObject: PIXI.IRenderableObject,
  options?: PIXI.IGenerateTextureOptions
) => PIXI.RenderTexture;
