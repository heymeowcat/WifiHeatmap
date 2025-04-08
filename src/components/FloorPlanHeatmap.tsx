import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Rect, Circle } from 'react-native-svg';
import ReactNativeZoomableView from '@dudigital/react-native-zoomable-view/src/ReactNativeZoomableView';
import { HeatmapDataPoint, interpolateSignalStrength, getColorForSignalStrength } from '../utils/HeatmapUtils';
import MarkerComponent from './MarkerComponent';
import { useTheme } from '../theme/ThemeProvider';

interface FloorPlanHeatmapProps {
  floorPlanDimensions: { width: number; height: number };
  heatmapData: HeatmapDataPoint[];
  markerPosition: { x: number; y: number } | null;
  isMarkingMode: boolean;
  onFloorPlanPress: (x: number, y: number) => void;
}

const FloorPlanHeatmap: React.FC<FloorPlanHeatmapProps> = ({
  floorPlanDimensions,
  heatmapData,
  markerPosition,
  isMarkingMode,
  onFloorPlanPress,
}) => {
  const theme = useTheme();
  const { width, height } = floorPlanDimensions;
  
  const handlePress = (event: any) => {
    if (isMarkingMode) {
      const { locationX, locationY } = event.nativeEvent;
      onFloorPlanPress(locationX, locationY);
    }
  };

  const renderHeatmap = () => {
    if (heatmapData.length === 0) return null;

    const cellSize = 10;
    const columns = Math.floor(width / cellSize);
    const rows = Math.floor(height / cellSize);

    const heatmapCells = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const centerX = (x + 0.5) * cellSize;
        const centerY = (y + 0.5) * cellSize;
        const strength = interpolateSignalStrength(centerX, centerY, heatmapData);

        if (strength !== null) {
          const color = getColorForSignalStrength(strength);
          heatmapCells.push(
            <Rect
              key={`${x}-${y}`}
              x={x * cellSize}
              y={y * cellSize}
              width={cellSize}
              height={cellSize}
              fill={color}
              opacity={0.7}
            />,
          );
        }
      }
    }

    return (
      <>
        {heatmapCells}
        {heatmapData.map((point, index) => (
          <Circle key={index} cx={point.x} cy={point.y} r={3} fill={theme.colors.text} />
        ))}
      </>
    );
  };

  return (
    <ReactNativeZoomableView
      maxZoom={3}
      minZoom={0.5}
      zoomStep={0.5}
      initialZoom={1}
      bindToBorders={true}
      style={styles.zoomableView}
    >
      <TouchableOpacity onPress={handlePress} activeOpacity={1}>
        <View>
          <View
            style={[
              styles.floorPlan,
              { width, height, backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          />
          <Svg style={[StyleSheet.absoluteFill, { width, height }]}>
            {renderHeatmap()}
          </Svg>
          {markerPosition && <MarkerComponent position={markerPosition} />}
        </View>
      </TouchableOpacity>
    </ReactNativeZoomableView>
  );
};

const styles = StyleSheet.create({
  zoomableView: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  floorPlan: {
    borderWidth: 1,
  },
});

export default FloorPlanHeatmap;