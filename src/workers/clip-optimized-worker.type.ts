export type Matrix4Tuple = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];

export type Vec2Tuple = [number, number];
export type Vec3Tuple = [number, number, number];

export interface SerializedGeometry {
  position: Float32Array;
  index: Uint32Array | null;
}

export interface SerializedMesh {
  geometry: SerializedGeometry;
  matrixWorld: Matrix4Tuple;
}

export interface PlaneBasisSerialized {
  origin: Vec3Tuple;
  xAxis: Vec3Tuple;
  yAxis: Vec3Tuple;
  normal: Vec3Tuple;
}

export interface ClipRequest {
  plane: SerializedMesh;
  basis: PlaneBasisSerialized;
  targets: SerializedMesh[];
  tolerance: number;
}

export interface PolygonResult {
  sourceIndex: number;
  triangles: Float32Array; // 3D triangles
  lines: Float32Array; // 3D polygon edges
}

export interface ClipResponse {
  polygons: PolygonResult[];
}
