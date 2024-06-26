import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import WifiManager from 'react-native-wifi-reborn';
import MapView, {Heatmap, Marker} from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';

const App = () => {
  const [wifiData, setWifiData] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message:
              'This app needs access to your location to create a WiFi heatmap.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Location permission granted');
          startLocationUpdates();
        } else {
          setErrorMsg('Location permission denied');
        }
      } catch (err) {
        console.warn(err);
        setErrorMsg('Error requesting location permission');
      }
    } else {
      startLocationUpdates();
    }
  };

  const startLocationUpdates = () => {
    const watchId = Geolocation.watchPosition(
      position => {
        const {latitude, longitude} = position.coords;
        const newLocation = {latitude, longitude};
        setCurrentLocation(newLocation);
        scanWifi(newLocation);
      },
      error => setErrorMsg(error.message),
      {
        enableHighAccuracy: true,
        distanceFilter: 10,
        interval: 5000,
        fastestInterval: 2000,
      },
    );

    return () => Geolocation.clearWatch(watchId);
  };

  const scanWifi = async location => {
    try {
      const wifiList = await WifiManager.loadWifiList();
      const parsedWifiList =
        typeof wifiList === 'string' ? JSON.parse(wifiList) : wifiList;

      const wifiDataWithLocation = parsedWifiList.map(wifi => ({
        latitude: location.latitude,
        longitude: location.longitude,
        intensity: Math.abs(wifi.level),
      }));

      setWifiData(prevData => [...prevData, ...wifiDataWithLocation]);
    } catch (error) {
      setErrorMsg('Failed to scan WiFi: ' + error.message);
    }
  };

  return (
    <View style={styles.container}>
      {errorMsg ? (
        <Text style={styles.error}>{errorMsg}</Text>
      ) : (
        <MapView
          style={styles.map}
          region={{
            latitude: currentLocation ? currentLocation.latitude : 37.78825,
            longitude: currentLocation ? currentLocation.longitude : -122.4324,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
          showsUserLocation={true}>
          {wifiData.length > 0 && (
            <Heatmap
              points={wifiData}
              radius={20}
              opacity={0.8}
              maxIntensity={100}
              gradientSmoothing={10}
              heatmapMode={'POINTS_WEIGHT'}
            />
          )}
          {currentLocation && (
            <Marker coordinate={currentLocation} title="You are here" />
          )}
        </MapView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  error: {
    color: 'red',
    fontSize: 18,
    margin: 10,
  },
});

export default App;
