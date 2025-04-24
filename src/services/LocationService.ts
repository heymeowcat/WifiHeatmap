import Geolocation, { 
  GeoPosition, 
  GeoError,
  GeoOptions 
} from 'react-native-geolocation-service';
import { Platform, PermissionsAndroid } from 'react-native';
import { LocationData } from '../types/heatmap';

class LocationService {
  private watchId: number | null = null;
  private highAccuracy: boolean = true;

  async requestLocationPermission(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      try {
        const auth = await Geolocation.requestAuthorization('whenInUse');
        return auth === 'granted';
      } catch (error) {
        console.error('Error requesting iOS location permission:', error);
        return false;
      }
    }

    if (Platform.OS === 'android') {
      try {
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
      } catch (error) {
        console.error('Error requesting Android location permission:', error);
        return false;
      }
    }

    return false;
  }

  setHighAccuracy(highAccuracy: boolean): void {
    this.highAccuracy = highAccuracy;
  }

  startLocationTracking(
    onSuccess: (location: LocationData) => void,
    onError: (error: GeoError) => void,
  ): void {
    if (this.watchId !== null) {
      this.stopLocationTracking();
    }

    const options: GeoOptions = {
      enableHighAccuracy: this.highAccuracy,
      distanceFilter: 0,
      interval: 1000,
      fastestInterval: 500,
    };

    this.watchId = Geolocation.watchPosition(
      (position: GeoPosition) => {
        const locationData: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        };
        onSuccess(locationData);
      },
      onError,
      options,
    );
  }

  stopLocationTracking(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  getCurrentPosition(
    onSuccess: (location: LocationData) => void,
    onError: (error: GeoError) => void,
  ): void {
    const options: GeoOptions = {
      enableHighAccuracy: this.highAccuracy,
      timeout: 15000,
      maximumAge: 10000,
    };

    Geolocation.getCurrentPosition(
      (position: GeoPosition) => {
        const locationData: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        };
        onSuccess(locationData);
      },
      onError,
      options,
    );
  }
}

export default new LocationService();