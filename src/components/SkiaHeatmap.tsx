import React from 'react';
import { View, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { Canvas, Circle, Image, useImage, Paint, vec } from '@shopify/react-native-skia';
import { HeatmapDataPoint } from '../types/heatmap';
// Remove any direct imports from Reanimated if they exist

interface SkiaHeatmapProps {
  width: number;
  height: number;
  data: HeatmapDataPoint[];
  floorPlanImage: string | null;
  markerPosition: { x: number; y: number } | null;
  onPress: (x: number, y: number) => void;
}

const SkiaHeatmap: React.FC<SkiaHeatmapProps> = ({
  width,
  height,
  data,
  floorPlanImage,
  markerPosition,
  onPress,
}) => {
  const image = useImage(floorPlanImage || '');

  const handlePress = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    onPress(locationX, locationY);
  };

  // Function to get color based on signal strength
  const getColor = (strength: number) => {
    // Signal strength is typically between -100 (weak) and -30 (strong)
    const normalized = Math.min(Math.max((strength + 100) / 70, 0), 1);
    
    // Color gradient from red (weak) to green (strong)
    const r = Math.floor(255 * (1 - normalized));
    const g = Math.floor(255 * normalized);
    const b = 0;
    
    return `rgba(${r}, ${g}, ${b}, 0.7)`;
  };

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <View style={[styles.container, { width, height }]}>
        <Canvas style={{ flex: 1 }}>
          {/* Draw floor plan if available */}
          {image && (
            <Image
              image={image}
              fit="contain"
              x={0}
              y={0}
              width={width}
              height={height}
            />
          )}

          {/* Draw heatmap points */}
          {data.map((point, index) => (
            <Circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={30}
              color={getColor(point.strength)}
              opacity={0.7}
            >
              <Paint style="fill" />
            </Circle>
          ))}

          {/* Draw marker if available */}
          {markerPosition && (
            <Circle
              cx={markerPosition.x}
              cy={markerPosition.y}
              r={10}
              color="blue"
            >
              <Paint style="fill" />
            </Circle>
          )}
        </Canvas>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
  },
});

export default SkiaHeatmap;