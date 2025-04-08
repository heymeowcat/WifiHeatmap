import { getSignalStrengthColor } from '../theme/colors';

export interface HeatmapDataPoint {
  x: number;
  y: number;
  strength: number;
}

export const interpolateSignalStrength = (
  x: number,
  y: number,
  dataPoints: HeatmapDataPoint[],
): number | null => {
  const MAX_DISTANCE = 50;
  let totalWeight = 0;
  let weightedSum = 0;

  dataPoints.forEach(point => {
    const distance = Math.sqrt(
      Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2),
    );
    if (distance <= MAX_DISTANCE) {
      const weight = 1 / (distance + 1);
      totalWeight += weight;
      weightedSum += weight * point.strength;
    }
  });

  return totalWeight > 0 ? weightedSum / totalWeight : null;
};

export const smoothPosition = (
  newPos: { x: number; y: number },
  oldPos: { x: number; y: number },
  factor = 0.2,
): { x: number; y: number } => {
  return {
    x: oldPos.x + (newPos.x - oldPos.x) * factor,
    y: oldPos.y + (newPos.y - oldPos.y) * factor,
  };
};

export const getColorForSignalStrength = (strength: number): string => {
  return getSignalStrengthColor(strength);
};