import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  Image,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import WifiManager from 'react-native-wifi-reborn';
import MapView, {Heatmap, Marker} from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import {launchImageLibrary} from 'react-native-image-picker';

const App = () => {
  const [wifiData, setWifiData] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [floorPlan, setFloorPlan] = useState(null);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [scanStatus, setScanStatus] = useState('Idle');

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
      setScanStatus('Detecting');
      const wifiList = await WifiManager.loadWifiList();
      const parsedWifiList =
        typeof wifiList === 'string' ? JSON.parse(wifiList) : wifiList;
      const wifiDataWithLocation = parsedWifiList.map(wifi => ({
        latitude: location.latitude,
        longitude: location.longitude,
        intensity: Math.abs(wifi.level),
      }));
      setWifiData(prevData => [...prevData, ...wifiDataWithLocation]);

      const connectedWifi = await WifiManager.getCurrentWifiSSID();
      setConnectedDevice(connectedWifi);

      setScanStatus('Idle');
    } catch (error) {
      setErrorMsg('Failed to scan WiFi: ' + error.message);
      setScanStatus('Error');
    }
  };

  const uploadFloorPlan = () => {
    launchImageLibrary({mediaType: 'photo'}, response => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.error) {
        console.log('ImagePicker Error: ', response.error);
      } else if (response.assets && response.assets.length > 0) {
        setFloorPlan(response.assets[0].uri);
      }
    });
  };

  return (
    <ScrollView style={styles.container}>
      {errorMsg ? (
        <Text style={styles.error}>{errorMsg}</Text>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Connected Device</Text>
            <Text>{connectedDevice || 'Not connected'}</Text>
            <Text>Status: {scanStatus}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Google Maps</Text>
            <MapView
              style={styles.map}
              region={{
                latitude: currentLocation ? currentLocation.latitude : 37.78825,
                longitude: currentLocation
                  ? currentLocation.longitude
                  : -122.4324,
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
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Coverage Map</Text>
            <TouchableOpacity style={styles.button} onPress={uploadFloorPlan}>
              <Text style={styles.buttonText}>Upload Floor Plan</Text>
            </TouchableOpacity>
            {floorPlan && (
              <View style={styles.floorPlanContainer}>
                <Image source={{uri: floorPlan}} style={styles.floorPlan} />
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  map: {
    height: 200,
    marginVertical: 10,
  },
  button: {
    backgroundColor: '#3399FF',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  floorPlanContainer: {
    marginTop: 10,
    height: 200,
  },
  floorPlan: {
    flex: 1,
    resizeMode: 'contain',
  },
  error: {
    color: 'red',
    fontSize: 18,
    margin: 10,
  },
});

export default App;
