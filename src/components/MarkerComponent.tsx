import React from 'react';
import { Image, StyleSheet } from 'react-native';

interface MarkerComponentProps {
  position: { x: number; y: number };
}

const MarkerComponent: React.FC<MarkerComponentProps> = ({ position }) => {
  return (
    <Image
      source={require('../../assets/marker.png')}
      style={[
        styles.marker,
        {
          left: position.x - 15,
          top: position.y - 30,
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  marker: {
    position: 'absolute',
    width: 30,
    height: 30,
  },
});

export default MarkerComponent;