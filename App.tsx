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
  TextInput,
  Modal,
} from 'react-native';
import WifiManager from 'react-native-wifi-reborn';
import Geolocation from '@react-native-community/geolocation';
import {launchImageLibrary} from 'react-native-image-picker';
import Svg, {Rect, Circle} from 'react-native-svg';
import {Picker} from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeZoomableView from '@openspacelabs/react-native-zoomable-view/src/ReactNativeZoomableView';

const GRID_SIZE = 20;

const DataTable = ({data}) => (
  <View style={styles.tableContainer}>
    <View style={styles.tableHeader}>
      <Text style={styles.tableHeaderCell}>Latitude</Text>
      <Text style={styles.tableHeaderCell}>Longitude</Text>
      <Text style={styles.tableHeaderCell}>Altitude</Text>
      <Text style={styles.tableHeaderCell}>Signal Strength</Text>
    </View>
    <ScrollView style={styles.tableBody}>
      {data.map((point, index) => (
        <View key={index} style={styles.tableRow}>
          <Text style={styles.tableCell}>{point.x?.toFixed(2) || 'N/A'}</Text>
          <Text style={styles.tableCell}>{point.y?.toFixed(2) || 'N/A'}</Text>
          <Text style={styles.tableCell}>
            {point.altitude?.toFixed(2) || 'N/A'}
          </Text>
          <Text style={styles.tableCell}>{point.signalStrength} dBm</Text>
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
  const [isWifiConnected, setIsWifiConnected] = useState(false);
  const [currentSSID, setCurrentSSID] = useState('');
  const [currentBSSID, setCurrentBSSID] = useState('');
  const [floorPlanDimensions, setFloorPlanDimensions] = useState({});

  const [markerPosition, setMarkerPosition] = useState(null);
  const [isMarkingMode, setIsMarkingMode] = useState(false);
  const [initialPosition, setInitialPosition] = useState(null);
  const [lastKnownLocation, setLastKnownLocation] = useState(null);

  const [lastUpdatedPosition, setLastUpdatedPosition] = useState(null);

  useEffect(() => {
    if (lastKnownLocation && initialPosition) {
      console.log('Updating marker position');
      updateMarkerPosition(
        lastKnownLocation.latitude,
        lastKnownLocation.longitude,
      );
    } else {
      console.log(
        'Initial position or last known location not set, cannot update marker',
      );
    }
  }, [lastKnownLocation, initialPosition]);

  const [scanInterval, setScanInterval] = useState(null);

  useEffect(() => {
    console.log('Initial position updated:', initialPosition);
  }, [initialPosition]);

  const watchId = useRef(null);
  const lastRecordedPosition = useRef(null);

  useEffect(() => {
    if (markerPosition && currentLocation && !initialPosition) {
      setInitialPosition(currentLocation);
    }
  }, [markerPosition, currentLocation]);

  useEffect(() => {
    console.log('Marker position updated:', markerPosition);
  }, [markerPosition]);

  useEffect(() => {
    requestLocationPermission();
    checkWifiConnection();
    startLocationTracking();

    return () => {
      if (watchId.current) Geolocation.clearWatch(watchId.current);
    };
  }, []);

  const startLocationTracking = () => {
    watchId.current = Geolocation.watchPosition(
      position => {
        const {latitude, longitude} = position.coords;
        console.log('New location:', {latitude, longitude});

        setLastKnownLocation({latitude, longitude});
      },
      error => console.log('Error watching position:', error),
      {
        enableHighAccuracy: true,
        distanceFilter: 0,
        interval: 1000,
        fastestInterval: 500,
      },
    );
  };

  useEffect(() => {
    requestLocationPermission();
    checkWifiConnection();
    startLocationTracking();

    return () => {
      if (watchId.current) Geolocation.clearWatch(watchId.current);
      if (scanInterval) clearInterval(scanInterval);
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

  const checkWifiConnection = async () => {
    try {
      const ssid = await WifiManager.getCurrentWifiSSID();
      setIsWifiConnected(!!ssid);
      setConnectedDevice(ssid || 'Not connected');
      setCurrentSSID(ssid || 'N/A');

      if (typeof WifiManager.getCurrentWifiBSSID === 'function') {
        const bssid = await WifiManager.getCurrentWifiBSSID();
        setCurrentBSSID(bssid || 'N/A');
      } else {
        setCurrentBSSID('Not available');
      }
    } catch (error) {
      console.error('Error checking WiFi connection:', error);
      setIsWifiConnected(false);
      setConnectedDevice('Not connected');
      setCurrentSSID('N/A');
      setCurrentBSSID('N/A');
    }
  };

  const startCapturing = () => {
    if (!isWifiConnected) {
      setErrorMsg('Please connect to a WiFi network before capturing.');
      return;
    }
    if (!markerPosition) {
      setErrorMsg('Please place a marker on the floor plan before capturing.');
      return;
    }
    setIsCapturing(true);
    setWifiData([]);

    const interval = setInterval(() => {
      scanWifiAndUpdateHeatmap();
    }, 2000); // Scan every 2 seconds
    setScanInterval(interval);
  };

  const stopCapturing = () => {
    setIsCapturing(false);
    if (scanInterval) {
      clearInterval(scanInterval);
      setScanInterval(null);
    }
  };

  const scanWifiAndUpdateHeatmap = async () => {
    if (!markerPosition || !initialPosition) return;

    try {
      setScanStatus('Detecting');
      const wifiList = await WifiManager.loadWifiList();
      const parsedWifiList =
        typeof wifiList === 'string' ? JSON.parse(wifiList) : wifiList;

      const newWifiData = parsedWifiList.map(wifi => ({
        x: markerPosition.x,
        y: markerPosition.y,
        signalStrength: wifi.level,
        SSID: wifi.SSID,
        BSSID: wifi.BSSID,
      }));

      setWifiData(prevData => [...prevData, ...newWifiData]);
      updateHeatmap(newWifiData);
      setScanStatus('Idle');
    } catch (error) {
      setErrorMsg('Failed to scan WiFi: ' + error.message);
      setScanStatus('Error');
    }
  };

  const updateHeatmap = newData => {
    setFloorPlanWifiData(prevData => {
      const updatedData = {...prevData};
      if (!updatedData[currentFloor]) {
        updatedData[currentFloor] = [];
      }

      newData.forEach(data => {
        updatedData[currentFloor].push({
          x: data.x,
          y: data.y,
          strength: data.signalStrength,
        });
      });

      return updatedData;
    });
  };

  const saveWifiData = async () => {
    try {
      await AsyncStorage.setItem('wifiData', JSON.stringify(wifiData));
    } catch (error) {
      console.error('Error saving WiFi data:', error);
    }
  };

  const updateMarkerPosition = (latitude, longitude) => {
    if (!initialPosition || !lastUpdatedPosition) {
      console.log(
        'Initial position or last updated position not set, cannot update marker',
      );
      return;
    }

    const {width, height} = floorPlanDimensions[currentFloor] || {
      width: 300,
      height: 200,
    };

    const latitudeDiff = latitude - lastUpdatedPosition.latitude;
    const longitudeDiff = longitude - lastUpdatedPosition.longitude;

    console.log(
      'Latitude diff:',
      latitudeDiff,
      'Longitude diff:',
      longitudeDiff,
    );

    const pixelsPerDegree = {
      x: width / 0.001,
      y: height / 0.001,
    };

    const newX = markerPosition.x + longitudeDiff * pixelsPerDegree.x;
    const newY = markerPosition.y - latitudeDiff * pixelsPerDegree.y;

    console.log('Calculated new position:', {x: newX, y: newY});

    setMarkerPosition({x: newX, y: newY});
    setLastUpdatedPosition({latitude, longitude});
  };

  const handleFloorPlanPress = event => {
    if (isMarkingMode) {
      const {locationX, locationY} = event.nativeEvent;
      setMarkerPosition({x: locationX, y: locationY});
      setIsMarkingMode(false);
      if (lastKnownLocation) {
        console.log('Setting initial position:', lastKnownLocation);
        setInitialPosition(lastKnownLocation);
        setLastUpdatedPosition(lastKnownLocation);
      } else {
        console.log(
          'Last known location not available, cannot set initial position',
        );
      }
      console.log('Marker placed at:', {x: locationX, y: locationY});
    }
  };

  useEffect(() => {
    if (lastKnownLocation && initialPosition && lastUpdatedPosition) {
      console.log('Updating marker position');
      updateMarkerPosition(
        lastKnownLocation.latitude,
        lastKnownLocation.longitude,
      );
    } else {
      console.log(
        'Initial position, last updated position, or last known location not set, cannot update marker',
      );
    }
  }, [lastKnownLocation]);

  const renderMarker = () => {
    if (!markerPosition) return null;
    console.log('Rendering marker at:', markerPosition);
    return (
      <Image
        source={require('./assets/marker.png')}
        style={{
          position: 'absolute',
          left: markerPosition.x - 15,
          top: markerPosition.y - 30,
          width: 30,
          height: 30,
        }}
      />
    );
  };

  const uploadFloorPlan = () => {
    launchImageLibrary({mediaType: 'photo'}, response => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.error) {
        console.log('ImagePicker Error: ', response.error);
      } else if (response.assets && response.assets.length > 0) {
        const uri = response.assets[0].uri;
        setFloorPlans(prevPlans => ({
          ...prevPlans,
          [currentFloor]: uri,
        }));

        Image.getSize(
          uri,
          (width, height) => {
            setFloorPlanDimensions(prevDimensions => ({
              ...prevDimensions,
              [currentFloor]: {width, height},
            }));
          },
          error => {
            console.error('Error getting image dimensions:', error);
          },
        );
      }
    });
  };

  const generateHeatmap = () => {
    const newFloorPlanWifiData = {...floorPlanWifiData};
    if (!newFloorPlanWifiData[currentFloor]) {
      newFloorPlanWifiData[currentFloor] = [];
    }

    const dimensions = floorPlanDimensions[currentFloor] || {
      width: 300,
      height: 200,
    };
    const {width, height} = dimensions;

    wifiData.forEach(data => {
      const x =
        ((data.longitude - (currentLocation?.longitude || 0)) / 0.0001) * width;
      const y =
        ((data.latitude - (currentLocation?.latitude || 0)) / 0.0001) * height;
      newFloorPlanWifiData[currentFloor].push({
        x,
        y,
        strength: data.signalStrength,
      });
    });

    setFloorPlanWifiData(newFloorPlanWifiData);
  };

  const interpolateSignalStrength = (x, y, dataPoints) => {
    const MAX_DISTANCE = 100;
    let totalWeight = 0;
    let weightedSum = 0;

    dataPoints.forEach(point => {
      const distance = Math.sqrt(
        Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2),
      );
      if (distance <= MAX_DISTANCE) {
        const weight = 1 / (distance + 1);
        totalWeight += weight;
        weightedSum += weight * point.strength;
      }
    });

    return totalWeight > 0 ? weightedSum / totalWeight : null;
  };

  const renderHeatmap = () => {
    if (!floorPlanWifiData[currentFloor]) return null;

    const dimensions = floorPlanDimensions[currentFloor] || {
      width: 300,
      height: 200,
    };
    const {width, height} = dimensions;
    const cellSize = 10;
    const columns = Math.floor(width / cellSize);
    const rows = Math.floor(height / cellSize);

    const dataPoints = floorPlanWifiData[currentFloor];

    const heatmapCells = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const centerX = (x + 0.5) * cellSize;
        const centerY = (y + 0.5) * cellSize;
        const strength = interpolateSignalStrength(
          centerX,
          centerY,
          dataPoints,
        );

        if (strength !== null) {
          const color = getColorForSignalStrength(strength);
          heatmapCells.push(
            <Rect
              key={`${x}-${y}`}
              x={x * cellSize}
              y={y * cellSize}
              width={cellSize}
              height={cellSize}
              fill={color}
              opacity={0.7}
            />,
          );
        }
      }
    }

    return (
      <>
        {heatmapCells}
        {dataPoints.map((point, index) => (
          <Circle key={index} cx={point.x} cy={point.y} r={3} fill="black" />
        ))}
      </>
    );
  };

  const getColorForSignalStrength = strength => {
    const normalizedStrength = (strength + 100) / 70;
    const hue = (1 - normalizedStrength) * 240;
    return `hsl(${hue}, 100%, 50%)`;
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
            <Text>Status: {scanStatus}</Text>
            <Text>SSID: {currentSSID}</Text>
            <Text>BSSID: {currentBSSID}</Text>
            <TouchableOpacity
              style={[
                styles.button,
                isCapturing && styles.stopButton,
                !isWifiConnected && styles.disabledButton,
              ]}
              onPress={isCapturing ? stopCapturing : startCapturing}
              disabled={!isWifiConnected}>
              <Text style={styles.buttonText}>
                {isCapturing ? 'Stop Capturing' : 'Start Capturing'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* <View style={styles.card}>
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
                    weight: Math.abs(data.signalStrength),
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
          </View> */}

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
            <TouchableOpacity
              style={[styles.button, isMarkingMode && styles.activeButton]}
              onPress={() => setIsMarkingMode(!isMarkingMode)}>
              <Text style={styles.buttonText}>
                {isMarkingMode ? 'Cancel Marking' : 'Place Marker'}
              </Text>
            </TouchableOpacity>
            {floorPlans[currentFloor] && floorPlanDimensions[currentFloor] && (
              <ReactNativeZoomableView
                maxZoom={3}
                minZoom={0.5}
                zoomStep={0.5}
                initialZoom={1}
                bindToBorders={true}
                style={styles.zoomableView}>
                <TouchableOpacity
                  onPress={handleFloorPlanPress}
                  activeOpacity={1}>
                  <View>
                    <Image
                      source={{uri: floorPlans[currentFloor]}}
                      style={[
                        styles.floorPlan,
                        {
                          width: floorPlanDimensions[currentFloor].width,
                          height: floorPlanDimensions[currentFloor].height,
                        },
                      ]}
                    />
                    <Svg
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          width: floorPlanDimensions[currentFloor].width,
                          height: floorPlanDimensions[currentFloor].height,
                        },
                      ]}>
                      {renderHeatmap()}
                    </Svg>
                    {renderMarker()}
                  </View>
                </TouchableOpacity>
              </ReactNativeZoomableView>
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
  zoomableView: {
    width: '100%',
    height: 300,
  },
  legendContainer: {
    marginTop: 10,
    alignItems: 'center',
    width: '100%',
  },
  legendGradient: {
    width: '100%',
    height: 20,
    marginVertical: 5,
  },
  legendLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  legendText: {
    fontSize: 12,
  },
  activeButton: {
    backgroundColor: '#33CC33',
  },
});

export default App;
