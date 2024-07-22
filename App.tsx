import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import WifiManager from 'react-native-wifi-reborn';
import MapView, {Heatmap, Marker} from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import {launchImageLibrary} from 'react-native-image-picker';
import Svg, {Rect} from 'react-native-svg';

const {width} = Dimensions.get('window');

const GRID_SIZE = 20;

const DataTable = ({data}) => (
  <View style={styles.tableContainer}>
    <View style={styles.tableHeader}>
      <Text style={styles.tableHeaderCell}>Latitude</Text>
      <Text style={styles.tableHeaderCell}>Longitude</Text>
      <Text style={styles.tableHeaderCell}>Strength</Text>
      {data.some(point => 'altitude' in point) && (
        <Text style={styles.tableHeaderCell}>Altitude</Text>
      )}
    </View>
    <ScrollView style={styles.tableBody}>
      {data.map((point, index) => (
        <View key={index} style={styles.tableRow}>
          <Text style={styles.tableCell}>{point.latitude.toFixed(6)}</Text>
          <Text style={styles.tableCell}>{point.longitude.toFixed(6)}</Text>
          <Text style={styles.tableCell}>{point.intensity}</Text>
          {point.altitude !== undefined && (
            <Text style={styles.tableCell}>{point.altitude.toFixed(2)}</Text>
          )}
        </View>
      ))}
    </ScrollView>
  </View>
);

const App = () => {
  const [wifiData, setWifiData] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [floorPlan, setFloorPlan] = useState(null);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [scanStatus, setScanStatus] = useState('Idle');
  const [isCapturing, setIsCapturing] = useState(false);
  const [floorPlanWifiData, setFloorPlanWifiData] = useState(
    Array(GRID_SIZE)
      .fill()
      .map(() => Array(GRID_SIZE).fill(0)),
  );
  const [imageSize, setImageSize] = useState({width: 0, height: 0});

  const watchId = useRef(null);

  useEffect(() => {
    requestLocationPermission();
    return () => {
      if (watchId.current) Geolocation.clearWatch(watchId.current);
    };
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
        } else {
          setErrorMsg('Location permission denied');
        }
      } catch (err) {
        console.warn(err);
        setErrorMsg('Error requesting location permission');
      }
    }
  };

  const startCapturing = () => {
    setIsCapturing(true);
    watchId.current = Geolocation.watchPosition(
      position => {
        const {latitude, longitude, altitude} = position.coords;
        scanWifi({latitude, longitude, altitude});
      },
      error => setErrorMsg(error.message),
      {
        enableHighAccuracy: true,
        distanceFilter: 2,
        interval: 5000,
        fastestInterval: 2000,
      },
    );
  };

  const stopCapturing = () => {
    setIsCapturing(false);
    if (watchId.current) Geolocation.clearWatch(watchId.current);
  };

  const scanWifi = async location => {
    try {
      setScanStatus('Detecting');
      const wifiList = await WifiManager.loadWifiList();
      const parsedWifiList =
        typeof wifiList === 'string' ? JSON.parse(wifiList) : wifiList;

      const newWifiData = parsedWifiList.map(wifi => ({
        latitude: location.latitude,
        longitude: location.longitude,
        altitude: location.altitude,
        intensity: Math.abs(wifi.level),
      }));

      setWifiData(prevData => [...prevData, ...newWifiData]);

      const gridX = Math.floor(Math.random() * GRID_SIZE);
      const gridY = Math.floor(Math.random() * GRID_SIZE);
      const avgIntensity =
        newWifiData.reduce((sum, data) => sum + data.intensity, 0) /
        newWifiData.length;

      setFloorPlanWifiData(prevData => {
        const newData = [...prevData];
        newData[gridY][gridX] = Math.max(newData[gridY][gridX], avgIntensity);
        return newData;
      });

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
        Image.getSize(response.assets[0].uri, (width, height) => {
          setImageSize({width, height});
        });
      }
    });
  };

  const renderHeatmap = () => {
    const cellWidth = imageSize.width / GRID_SIZE;
    const cellHeight = imageSize.height / GRID_SIZE;
    const maxIntensity = Math.max(...floorPlanWifiData.flat());

    return floorPlanWifiData.flatMap((row, y) =>
      row.map((intensity, x) => {
        const opacity = intensity / maxIntensity;
        return (
          <Rect
            key={`${x}-${y}`}
            x={x * cellWidth}
            y={y * cellHeight}
            width={cellWidth}
            height={cellHeight}
            fill="red"
            opacity={opacity}
          />
        );
      }),
    );
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
            <TouchableOpacity
              style={[styles.button, isCapturing && styles.stopButton]}
              onPress={isCapturing ? stopCapturing : startCapturing}>
              <Text style={styles.buttonText}>
                {isCapturing ? 'Stop Capturing' : 'Start Capturing'}
              </Text>
            </TouchableOpacity>
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
            <Text style={styles.cardTitle}>Floor Plan Heatmap</Text>
            <TouchableOpacity style={styles.button} onPress={uploadFloorPlan}>
              <Text style={styles.buttonText}>Upload Floor Plan</Text>
            </TouchableOpacity>
            {floorPlan && (
              <View style={styles.floorPlanContainer}>
                <Image source={{uri: floorPlan}} style={styles.floorPlan} />
                <Svg
                  style={StyleSheet.absoluteFill}
                  width={imageSize.width}
                  height={imageSize.height}>
                  {renderHeatmap()}
                </Svg>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>WiFi Data Points</Text>
            <DataTable data={wifiData} />
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
    marginTop: 10,
  },
  stopButton: {
    backgroundColor: '#FF3333',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  floorPlanContainer: {
    marginTop: 10,
    height: 300,
    position: 'relative',
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
  tableContainer: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  tableHeaderCell: {
    flex: 1,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tableBody: {
    maxHeight: 200,
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  tableCell: {
    flex: 1,
    textAlign: 'center',
  },
});

export default App;
