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
    getCurrentLocation();
  }, []);

  const getRandomLocations = currentLocation => {
    const {latitude, longitude} = currentLocation;
    const locations = [
      {latitude: latitude + 0.0001, longitude: longitude + 0.0001, weight: 5},
      {latitude: latitude + 0.0001, longitude: longitude - 0.0001, weight: 5},
      {latitude: latitude - 0.0001, longitude: longitude + 0.0001, weight: 5},
      {latitude: latitude - 0.0001, longitude: longitude - 0.0001, weight: 5},
      {latitude: latitude + 0.0002, longitude: longitude, weight: 5},
    ];

    return locations;
  };

  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      position => {
        const {latitude, longitude} = position.coords;
        setCurrentLocation({latitude, longitude});
        scanWifi({latitude, longitude});
        console.log('Current location:', {latitude, longitude});
      },
      error => setErrorMsg(error.message),
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  };

  const scanWifi = location => {
    WifiManager.loadWifiList()
      .then(wifiList => {
        let parsedWifiList;
        try {
          if (typeof wifiList === 'string') {
            parsedWifiList = JSON.parse(wifiList);
          } else {
            parsedWifiList = wifiList;
          }
          const wifiDataWithLocation = parsedWifiList.map(wifi => ({
            ...wifi,
            latitude: location.latitude,
            longitude: location.longitude,
          }));

          // Generate random locations near the current location
          const randomLocations = getRandomLocations(location, 20, 0.01); // Generate 20 random locations within 0.01 radius

          const allData = [...wifiDataWithLocation, ...randomLocations];
          setWifiData(allData);
        } catch (error) {
          setErrorMsg('Failed to parse WiFi list: ' + error.message);
        }
      })
      .catch(error => {
        setErrorMsg(error.message);
      });
  };

  return (
    <View style={styles.container}>
      {errorMsg ? (
        <Text style={styles.error}>{errorMsg}</Text>
      ) : (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: currentLocation ? currentLocation.latitude : 37.78825,
            longitude: currentLocation ? currentLocation.longitude : -122.4324,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
          showsUserLocation={true}>
          {wifiData.length > 0 && (
            <Heatmap
              points={wifiData.map(wifi => ({
                latitude: wifi.latitude,
                longitude: wifi.longitude,
                weight: wifi.level,
              }))}
              radius={20}
              opacity={0.6}
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
