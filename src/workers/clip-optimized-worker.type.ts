export type GeometryData = {
  position: Float32Array;
  index: Uint32Array | Uint16Array | null;
};

export type MeshData = {
  geometry: GeometryData;
  matrixWorld: number[];
};

export type ClipInput = {
  plane: MeshData;
  targets: MeshData[];
  tolerance: number;
  planeNormal: number[];
};

export type MeshResultItem = {
  buffer: Float32Array;
  sourceIndex: number;
};

export type ClipResult = {
  lines: Float32Array[];
  meshes: MeshResultItem[];
};
