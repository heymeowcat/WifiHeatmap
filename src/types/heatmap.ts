export interface WifiNetwork {
  ssid: string;
  bssid: string;
  is80211mcResponder: boolean;
  frequency: number;
  level: number;
  channelWidth: number;
  centerFreq0: number;
}

export interface WifiDataPoint {
  x: number;
  y: number;
  signalStrength: number;
  distance?: number | null;
  quality?: number | null;
  timestamp: string;
}

export interface HeatmapDataPoint {
  x: number;
  y: number;
  strength: number;
  distance?: number | null;
  quality?: number | null;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export interface WifiInfo {
  ssid: string | null;
  bssid: string | null;
  signalStrength: number | null;
  frequency: number | null;
  is80211mcResponder: boolean;
}
