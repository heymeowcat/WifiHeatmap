import Geolocation from 'react-native-geolocation-service';
import { PermissionsAndroid, Platform } from 'react-native';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

let highAccuracyEnabled = true;

const requestLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'ios') {
    const auth = await Geolocation.requestAuthorization('whenInUse');
    return auth === 'granted';
  }

  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'WiFi Heatmap needs access to your location',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  return false;
};

const startLocationTracking = (
  onLocationUpdate: (location: LocationData) => void,
  onError: (error: any) => void,
) => {
  const watchId = Geolocation.watchPosition(
    position => {
      const { latitude, longitude, accuracy, timestamp } = position.coords;
      onLocationUpdate({ latitude, longitude, accuracy, timestamp });
    },
    error => {
      onError(error);
    },
    {
      enableHighAccuracy: highAccuracyEnabled,
      distanceFilter: 0.1, // minimum distance in meters
      interval: 1000, // minimum time interval in ms
      fastestInterval: 500, // fastest interval in ms
    },
  );

  return watchId;
};

const stopLocationTracking = (watchId?: number) => {
  if (watchId) {
    Geolocation.clearWatch(watchId);
  }
};

const setHighAccuracy = (enabled: boolean) => {
  highAccuracyEnabled = enabled;
};

export default {
  requestLocationPermission,
  startLocationTracking,
  stopLocationTracking,
  setHighAccuracy,
};