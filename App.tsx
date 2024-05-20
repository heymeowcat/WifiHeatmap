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
    const requestPermissions = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
            PermissionsAndroid.PERMISSIONS.ACCESS_WIFI_STATE,
          ]);

          if (
            granted['android.permission.ACCESS_FINE_LOCATION'] ===
              PermissionsAndroid.RESULTS.GRANTED &&
            granted['android.permission.ACCESS_COARSE_LOCATION'] ===
              PermissionsAndroid.RESULTS.GRANTED &&
            granted['android.permission.ACCESS_WIFI_STATE'] ===
              PermissionsAndroid.RESULTS.GRANTED
          ) {
            getCurrentLocation();
          } else {
            setErrorMsg('Location and WiFi permissions denied');
          }
        } catch (err) {
          setErrorMsg(err.message);
        }
      } else {
        getCurrentLocation();
      }
    };

    requestPermissions();
  }, []);

  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      position => {
        const {latitude, longitude} = position.coords;
        setCurrentLocation({latitude, longitude});
        scanWifi({latitude, longitude});
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
          setWifiData(wifiDataWithLocation);
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
