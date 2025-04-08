import Geolocation from 'react-native-geolocation-service';

export interface LocationData {
  latitude: number;
  longitude: number;
}

class LocationService {
  watchId: number | null = null;

  startLocationTracking(callback: (location: LocationData) => void, errorCallback?: (error: any) => void): void {
    this.watchId = Geolocation.watchPosition(
      position => {
        const { latitude, longitude } = position.coords;
        callback({ latitude, longitude });
      },
      error => {
        console.log('Error watching position:', error);
        if (errorCallback) errorCallback(error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 0,
        interval: 1000,
        fastestInterval: 500,
      },
    );
  }

  stopLocationTracking(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  getCurrentPosition(): Promise<LocationData> {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords;
          resolve({ latitude, longitude });
        },
        error => {
          console.log('Error getting current position:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        },
      );
    });
  }
}

export default new LocationService();