import WifiManager from 'react-native-wifi-reborn';
import { PermissionsAndroid, Platform } from 'react-native';

export interface WifiInfo {
  SSID: string;
  level: number;
}

export interface WifiDataPoint {
  x: number;
  y: number;
  signalStrength: number;
  SSID: string;
}

class WifiService {
  async requestLocationPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This app needs access to your location to create a WiFi heatmap.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Error requesting location permission:', err);
        return false;
      }
    }
    return true; // iOS handles permissions differently
  }

  async getCurrentWifiInfo(): Promise<{ ssid: string; strength: number }> {
    try {
      const ssid = await WifiManager.getCurrentWifiSSID();
      const level = await WifiManager.getCurrentSignalStrength();
      return { ssid: ssid || 'Not connected', strength: level };
    } catch (error) {
      console.error('Error checking WiFi connection:', error);
      return { ssid: 'Not connected', strength: 0 };
    }
  }

  async scanWifiNetworks(): Promise<WifiInfo[]> {
    try {
      const wifiList = await WifiManager.loadWifiList();
      return typeof wifiList === 'string' ? JSON.parse(wifiList) : wifiList;
    } catch (error) {
      console.error('Failed to scan WiFi:', error);
      throw error;
    }
  }
}

export default new WifiService();