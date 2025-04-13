import React from 'react';
import {View, StyleSheet, Text} from 'react-native';
import Svg, {Path, Circle} from 'react-native-svg';
import {useTheme} from '../theme/ThemeProvider';

interface WifiSignalIndicatorProps {
  signalStrength: number;
  size?: number;
  showText?: boolean;
}

const WifiSignalIndicator: React.FC<WifiSignalIndicatorProps> = ({
  signalStrength,
  size = 24,
  showText = true,
}) => {
  const theme = useTheme();

  // Convert dBm to quality percentage
  const getSignalQuality = (dBm: number): number => {
    // Normalize to 0-100% (assuming -50 dBm or higher is 100% and -100 dBm is 0%)
    if (dBm >= -50) return 100;
    if (dBm <= -100) return 0;
    return 2 * (dBm + 100); // Linear scale between -100 and -50
  };

  const quality = getSignalQuality(signalStrength);

  // Determine how many arcs to show (0-3)
  const getActiveArcs = (quality: number): number => {
    if (quality >= 75) return 3;
    if (quality >= 40) return 2;
    if (quality >= 15) return 1;
    return 0;
  };

  const activeArcs = getActiveArcs(quality);

  // Get active and inactive colors
  const activeColor = theme.dark ? '#FFFFFF' : '#000000';
  const inactiveColor = theme.colors.disabled;

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          {/* Dot at the bottom */}
          <Circle cx="12" cy="18" r="1.5" fill={activeColor} />

          {/* Small arc */}
          <Path
            d="M8.5,15.5 C10.5,13.5 13.5,13.5 15.5,15.5"
            fill="none"
            stroke={activeArcs >= 1 ? activeColor : inactiveColor}
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Medium arc */}
          <Path
            d="M5.5,12.5 C8.5,9.5 15.5,9.5 18.5,12.5"
            fill="none"
            stroke={activeArcs >= 2 ? activeColor : inactiveColor}
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Large arc */}
          <Path
            d="M2.5,9.5 C6.5,5.5 17.5,5.5 21.5,9.5"
            fill="none"
            stroke={activeArcs >= 3 ? activeColor : inactiveColor}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </Svg>
      </View>

      {showText && (
        <Text style={[styles.dbmText, {color: theme.colors.text}]}>
          {signalStrength} dBm
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 8,
  },
  dbmText: {
    fontSize: 14,
  },
});

export default WifiSignalIndicator;
