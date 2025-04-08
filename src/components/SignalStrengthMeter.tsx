import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

interface SignalStrengthMeterProps {
  signalStrength: number;
}

const SignalStrengthMeter: React.FC<SignalStrengthMeterProps> = ({ signalStrength }) => {
  const theme = useTheme();
  const radius = 50;
  const strokeWidth = 10;
  const normalizedStrength = Math.min(Math.max((signalStrength + 90) / 60, 0), 1) * Math.PI;

  const startAngle = -Math.PI;
  const endAngle = startAngle + normalizedStrength;

  const x1 = radius + (radius - strokeWidth / 2) * Math.cos(startAngle);
  const y1 = radius + (radius - strokeWidth / 2) * Math.sin(startAngle);
  const x2 = radius + (radius - strokeWidth / 2) * Math.cos(endAngle);
  const y2 = radius + (radius - strokeWidth / 2) * Math.sin(endAngle);

  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

  return (
    <View style={styles.container}>
      <Svg height={radius * 2} width={radius * 2}>
        <Circle
          cx={radius}
          cy={radius}
          r={radius - strokeWidth / 2}
          stroke={theme.colors.disabled}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Path
          d={`M${x1},${y1} A${radius - strokeWidth / 2},${
            radius - strokeWidth / 2
          } 0 ${largeArcFlag} 1 ${x2},${y2}`}
          stroke={theme.colors.primary}
          strokeWidth={strokeWidth}
          fill="none"
        />
      </Svg>
      <Text style={[styles.signalStrengthText, { color: theme.colors.text }]}>
        {signalStrength} dBm
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  signalStrengthText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SignalStrengthMeter;