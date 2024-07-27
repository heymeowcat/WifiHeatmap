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
  TextInput,
  Modal,
} from 'react-native';
import WifiManager from 'react-native-wifi-reborn';
import MapView, {Heatmap, Marker} from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import {launchImageLibrary} from 'react-native-image-picker';
import Svg, {Rect, Circle} from 'react-native-svg';
import {Picker} from '@react-native-picker/picker';

const {width} = Dimensions.get('window');

const GRID_SIZE = 20;

const DataTable = ({data}) => (
  <View style={styles.tableContainer}>
    <View style={styles.tableHeader}>
      <Text style={styles.tableHeaderCell}>SSID</Text>
      <Text style={styles.tableHeaderCell}>BSSID</Text>
      <Text style={styles.tableHeaderCell}>Strength</Text>
      <Text style={styles.tableHeaderCell}>Channel</Text>
    </View>
    <ScrollView style={styles.tableBody}>
      {data.map((point, index) => (
        <View key={index} style={styles.tableRow}>
          <Text style={styles.tableCell}>{point.SSID}</Text>
          <Text style={styles.tableCell}>{point.BSSID}</Text>
          <Text style={styles.tableCell}>{point.level} dBm</Text>
          <Text style={styles.tableCell}>{point.frequency}</Text>
        </View>
      ))}
    </ScrollView>
  </View>
);

const App = () => {
  const [wifiData, setWifiData] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [floorPlans, setFloorPlans] = useState({});
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [scanStatus, setScanStatus] = useState('Idle');
  const [isCapturing, setIsCapturing] = useState(false);
  const [floorPlanWifiData, setFloorPlanWifiData] = useState({});
  const [currentFloor, setCurrentFloor] = useState('1');
  const [isAddingFloor, setIsAddingFloor] = useState(false);
  const [newFloorName, setNewFloorName] = useState('');
  const [currentPositionOnFloorPlan, setCurrentPositionOnFloorPlan] =
    useState(null);

  const watchId = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    requestLocationPermission();
    return () => {
      isMounted.current = false;
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
        if (isMounted.current) {
          const {latitude, longitude, altitude} = position.coords;
          setCurrentLocation({latitude, longitude});
          scanWifi({latitude, longitude, altitude});
          updatePositionOnFloorPlan(latitude, longitude);
        }
      },
      error => {
        if (isMounted.current) {
          setErrorMsg(error.message);
        }
      },
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
        ...wifi,
        latitude: location.latitude,
        longitude: location.longitude,
        altitude: location.altitude,
      }));

      setWifiData(prevData => [...prevData, ...newWifiData]);

      const gridX = Math.floor(Math.random() * GRID_SIZE);
      const gridY = Math.floor(Math.random() * GRID_SIZE);
      const avgIntensity =
        newWifiData.reduce((sum, data) => sum + Math.abs(data.level), 0) /
        newWifiData.length;

      setFloorPlanWifiData(prevData => {
        const newData = {...prevData};
        if (!newData[currentFloor]) {
          newData[currentFloor] = Array(GRID_SIZE)
            .fill()
            .map(() => Array(GRID_SIZE).fill(0));
        }
        newData[currentFloor][gridY][gridX] = Math.max(
          newData[currentFloor][gridY][gridX],
          avgIntensity,
        );
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

  const updatePositionOnFloorPlan = (latitude, longitude) => {
    // This is a simplified example. You would need to implement proper
    // coordinate transformation based on your floor plan's scale and orientation.
    const x = (longitude - currentLocation.longitude) * 1000 + GRID_SIZE / 2;
    const y = (latitude - currentLocation.latitude) * 1000 + GRID_SIZE / 2;
    setCurrentPositionOnFloorPlan({x, y});
  };

  const uploadFloorPlan = () => {
    launchImageLibrary({mediaType: 'photo'}, response => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.error) {
        console.log('ImagePicker Error: ', response.error);
      } else if (response.assets && response.assets.length > 0) {
        setFloorPlans(prevPlans => ({
          ...prevPlans,
          [currentFloor]: response.assets[0].uri,
        }));
      }
    });
  };

  const renderHeatmap = () => {
    if (!floorPlans[currentFloor] || !floorPlanWifiData[currentFloor])
      return null;

    const floorPlanImage = Image.resolveAssetSource({
      uri: floorPlans[currentFloor],
    });
    const cellWidth = floorPlanImage.width / GRID_SIZE;
    const cellHeight = floorPlanImage.height / GRID_SIZE;
    const maxIntensity = Math.max(...floorPlanWifiData[currentFloor].flat());

    return (
      <>
        {floorPlanWifiData[currentFloor].flatMap((row, y) =>
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
        )}
        {currentPositionOnFloorPlan && (
          <Circle
            cx={currentPositionOnFloorPlan.x * cellWidth}
            cy={currentPositionOnFloorPlan.y * cellHeight}
            r={5}
            fill="blue"
          />
        )}
      </>
    );
  };

  const addNewFloor = () => {
    if (newFloorName.trim() !== '') {
      setFloorPlans(prevPlans => ({...prevPlans, [newFloorName]: null}));
      setCurrentFloor(newFloorName);
      setNewFloorName('');
      setIsAddingFloor(false);
    }
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
                  points={wifiData.map(data => ({
                    latitude: data.latitude,
                    longitude: data.longitude,
                    weight: Math.abs(data.level),
                  }))}
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
            <View style={styles.floorSelection}>
              <Picker
                selectedValue={currentFloor}
                style={styles.picker}
                onValueChange={itemValue => setCurrentFloor(itemValue)}>
                {Object.keys(floorPlans).map(floor => (
                  <Picker.Item
                    key={floor}
                    label={`Floor ${floor}`}
                    value={floor}
                  />
                ))}
              </Picker>
              <TouchableOpacity
                style={styles.addFloorButton}
                onPress={() => setIsAddingFloor(true)}>
                <Text style={styles.buttonText}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.button} onPress={uploadFloorPlan}>
              <Text style={styles.buttonText}>Upload Floor Plan</Text>
            </TouchableOpacity>
            {floorPlans[currentFloor] && (
              <View style={styles.floorPlanContainer}>
                <Image
                  source={{uri: floorPlans[currentFloor]}}
                  style={styles.floorPlan}
                />
                <Svg style={StyleSheet.absoluteFill}>{renderHeatmap()}</Svg>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>WiFi Data Points</Text>
            <DataTable data={wifiData} />
          </View>

          <Modal
            visible={isAddingFloor}
            transparent={true}
            animationType="slide">
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Add New Floor</Text>
                <TextInput
                  style={styles.input}
                  onChangeText={setNewFloorName}
                  value={newFloorName}
                  placeholder="Enter floor name or number"
                />
                <TouchableOpacity style={styles.button} onPress={addNewFloor}>
                  <Text style={styles.buttonText}>Add Floor</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => setIsAddingFloor(false)}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
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
  floorSelection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  picker: {
    flex: 1,
    height: 50,
  },
  addFloorButton: {
    backgroundColor: '#3399FF',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  cancelButton: {
    backgroundColor: '#999',
  },
});

export default App;
