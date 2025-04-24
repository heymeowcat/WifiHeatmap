import { PermissionsAndroid, Platform, NativeModules } from 'react-native';
import { WifiNetwork } from '../types/heatmap';

// Import the native module directly and provide fallbacks
const { WifiRtt } = NativeModules;

// Create mock data for development/testing when module is not available
const createMockWifiNetworks = (): WifiNetwork[] => {
  return [
    {
      ssid: 'Mock WiFi 1',
      bssid: '00:11:22:33:44:55',
      is80211mcResponder: true,
      frequency: 2462,
      level: -55,
      channelWidth: 20,
      centerFreq0: 2462
    },
    {
      ssid: 'Mock WiFi 2',
      bssid: '66:77:88:99:AA:BB',
      is80211mcResponder: false,
      frequency: 5180,
      level: -70,
      channelWidth: 40,
      centerFreq0: 5190
    }
  ];
};

class WifiService {
  async requestLocationPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'WiFi Heatmap Location Permission',
            message:
              'WiFi Heatmap needs access to your location ' +
              'to scan WiFi networks and perform RTT ranging.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    } else {
      // iOS doesn't support WiFi RTT yet
      return true;
    }
  }

  async getCurrentWifiInfo() {
    try {
      // For now, we'll just return basic info since we don't have a direct way to get current WiFi info
      const networks = await this.scanWifiNetworks();
      
      // Find the strongest network as a proxy for the current one
      if (networks && networks.length > 0) {
        const strongestNetwork = networks.reduce((prev, current) => 
          (prev.level > current.level) ? prev : current
        );
        
        return {
          ssid: strongestNetwork.ssid || 'Unknown',
          bssid: strongestNetwork.bssid,
          strength: strongestNetwork.level,
          frequency: strongestNetwork.frequency,
          is80211mcResponder: strongestNetwork.is80211mcResponder
        };
      }
      
      return {
        ssid: 'Not connected',
        bssid: null,
        strength: -100,
        frequency: null,
        is80211mcResponder: false
      };
    } catch (error) {
      console.error('Error getting current WiFi info:', error);
      // Return a default value instead of throwing
      return {
        ssid: 'Error',
        bssid: null,
        strength: -100,
        frequency: null,
        is80211mcResponder: false
      };
    }
  }

  async scanWifiNetworks(): Promise<WifiNetwork[]> {
    try {
      // If WifiRtt is not available, return mock data
      if (!WifiRtt) {
        console.warn('WifiRtt native module is not available, using mock data');
        return createMockWifiNetworks();
      }
      
      if (Platform.OS === 'android') {
        return await WifiRtt.scanWifiNetworks();
      } else {
        // iOS implementation would go here if supported
        console.log('WiFi RTT scanning not supported on iOS, using mock data');
        return createMockWifiNetworks();
      }
    } catch (error) {
      console.error('Error scanning WiFi networks:', error);
      // Return mock data instead of throwing
      return createMockWifiNetworks();
    }
  }

  async isRttAvailable(): Promise<boolean> {
    try {
      if (!WifiRtt) {
        console.warn('WifiRtt native module is not available');
        return false;
      }
      
      if (Platform.OS === 'android') {
        return await WifiRtt.isRttAvailable();
      } else {
        // iOS doesn't support WiFi RTT yet
        return false;
      }
    } catch (error) {
      console.error('Error checking RTT availability:', error);
      return false;
    }
  }

  async startRanging(bssid: string): Promise<any> {
    try {
      if (!WifiRtt) {
        console.warn('WifiRtt native module is not available');
        return null;
      }
      
      if (Platform.OS === 'android') {
        return await WifiRtt.startRanging(bssid);
      } else {
        // iOS doesn't support WiFi RTT yet
        console.warn('WiFi RTT ranging not supported on iOS');
        return null;
      }
    } catch (error) {
      console.error('Error starting ranging:', error);
      return null;
    }
  }

  async startMultipleRanging(): Promise<any[]> {
    try {
      if (!WifiRtt) {
        console.warn('WifiRtt native module is not available');
        return [];
      }
      
      if (Platform.OS === 'android') {
        return await WifiRtt.startMultipleRanging();
      } else {
        // iOS doesn't support WiFi RTT yet
        console.warn('WiFi RTT ranging not supported on iOS');
        return [];
      }
    } catch (error) {
      console.error('Error starting multiple ranging:', error);
      return [];
    }
  }
}

export default new WifiService();