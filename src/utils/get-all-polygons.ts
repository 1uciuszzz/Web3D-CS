import { Vector2 } from "three";

class SpatialHash {
  private grid: Map<string, number[]>;
  private cellSize: number;

  constructor(cellSize: number) {
    this.grid = new Map();
    this.cellSize = cellSize;
  }

  private getKey(x: number, y: number): string {
    const gridX = Math.floor(x / this.cellSize);
    const gridY = Math.floor(y / this.cellSize);
    return `${gridX},${gridY}`;
  }

  insert(pointIndex: number, x: number, y: number): void {
    const key = this.getKey(x, y);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key)!.push(pointIndex);
  }

  getNeighbors(x: number, y: number): number[] {
    const results: number[] = [];
    const gridX = Math.floor(x / this.cellSize);
    const gridY = Math.floor(y / this.cellSize);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${gridX + dx},${gridY + dy}`;
        const cell = this.grid.get(key);
        if (cell) {
          results.push(...cell);
        }
      }
    }

    return results;
  }
}

export const getAllPolygons = (points: Vector2[], tolerance: number) => {
  if (points.length < 2) return [];

  const graph = new Map<number, number[]>();

  const uniquePoints: Vector2[] = [];
  const pointIndexMap = new Map<string, number>();
  const spatialHash = new SpatialHash(tolerance);

  const getKey = (point: Vector2) => {
    const roundToTolerance = (value: number) =>
      Math.round(value / tolerance) * tolerance;
    return `${roundToTolerance(point.x)},${roundToTolerance(point.y)}`;
  };

  const pointAccumulators = new Map<
    string,
    { sumX: number; sumY: number; count: number }
  >();

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const key = getKey(point);

    if (!pointAccumulators.has(key)) {
      pointAccumulators.set(key, { sumX: 0, sumY: 0, count: 0 });
    }

    const acc = pointAccumulators.get(key)!;
    acc.sumX += point.x;
    acc.sumY += point.y;
    acc.count++;
  }

  pointAccumulators.forEach((acc, key) => {
    const avgX = acc.sumX / acc.count;
    const avgY = acc.sumY / acc.count;
    const avgPoint = new Vector2(avgX, avgY);
    const newIndex = uniquePoints.length;
    uniquePoints.push(avgPoint);
    pointIndexMap.set(key, newIndex);
    spatialHash.insert(newIndex, avgX, avgY);
  });

  for (let i = 0; i < points.length; i += 2) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const key1 = getKey(p1);
    const key2 = getKey(p2);
    const index1 = pointIndexMap.get(key1)!;
    const index2 = pointIndexMap.get(key2)!;

    if (!graph.has(index1)) graph.set(index1, []);
    if (!graph.has(index2)) graph.set(index2, []);
    graph.get(index1)!.push(index2);
    graph.get(index2)!.push(index1);
  }

  const visited = new Set<number>();
  const cycles: number[][] = [];
  const stack: { node: number; parent: number | null }[] = [];

  const findCycles = (node: number, parent: number | null) => {
    visited.add(node);
    stack.push({ node, parent });

    for (const neighbor of graph.get(node) || []) {
      if (neighbor === parent) continue;

      if (visited.has(neighbor)) {
        const cycleStartIndex = stack.findIndex(
          (item) => item.node === neighbor
        );
        if (cycleStartIndex !== -1) {
          const cycle = stack.slice(cycleStartIndex).map((item) => item.node);
          cycles.push(cycle);
        }
      } else {
        findCycles(neighbor, node);
      }
    }
    stack.pop();
  };

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      findCycles(node, null);
    }
  }

  const uniqueCycles = new Set<string>();
  const allPolygons: Vector2[][] = [];

  for (const cycle of cycles) {
    const sortedCycle = [...cycle].sort((a, b) => a - b).join(",");
    if (!uniqueCycles.has(sortedCycle)) {
      uniqueCycles.add(sortedCycle);
      const polygonPoints = cycle.map((index) => uniquePoints[index]);

      if (polygonPoints.length >= 3) {
        allPolygons.push(polygonPoints);
      }
    }
  }

  return allPolygons;
};
