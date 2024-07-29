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
  PanResponder,
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
          <Text style={styles.tableCell}>{point.latitude.toFixed(6)}</Text>
          <Text style={styles.tableCell}>{point.longitude.toFixed(6)}</Text>
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
  const [markedLocations, setMarkedLocations] = useState({});
  const [isMarkingMode, setIsMarkingMode] = useState(false);

  const [panOffset, setPanOffset] = useState({x: 0, y: 0});

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        setPanOffset(prevOffset => ({
          x: prevOffset.x + gestureState.dx,
          y: prevOffset.y + gestureState.dy,
        }));
      },
    }),
  ).current;

  const watchId = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    requestLocationPermission();
    checkWifiConnection();
    return () => {
      isMounted.current = false;
      if (watchId.current) Geolocation.clearWatch(watchId.current);
    };
  }, []);

  const renderFloorPlan = () => {
    if (floorPlans[currentFloor] && floorPlanDimensions[currentFloor]) {
      return (
        <ReactNativeZoomableView
          maxZoom={3}
          minZoom={0.5}
          zoomStep={0.5}
          initialZoom={1}
          bindToBorders={true}
          style={styles.zoomableView}>
          <View {...panResponder.panHandlers}>
            <Image
              source={{uri: floorPlans[currentFloor]}}
              style={[
                styles.floorPlan,
                {
                  width: floorPlanDimensions[currentFloor].width,
                  height: floorPlanDimensions[currentFloor].height,
                  transform: [
                    {translateX: panOffset.x},
                    {translateY: panOffset.y},
                  ],
                },
              ]}
            />
            <Svg
              style={[
                StyleSheet.absoluteFill,
                {
                  width: floorPlanDimensions[currentFloor].width,
                  height: floorPlanDimensions[currentFloor].height,
                  transform: [
                    {translateX: panOffset.x},
                    {translateY: panOffset.y},
                  ],
                },
              ]}>
              {renderHeatmap()}
              {currentPositionOnFloorPlan && (
                <Circle
                  cx={currentPositionOnFloorPlan.x}
                  cy={currentPositionOnFloorPlan.y}
                  r={5}
                  fill="blue"
                />
              )}
            </Svg>
          </View>
        </ReactNativeZoomableView>
      );
    }
    return null;
  };

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

      // Check if getCurrentWifiBSSID is available
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
      setErrorMsg('Please connect to a WiFi network before capturing data.');
      return;
    }
    setIsCapturing(true);
    setWifiData([]);
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

  const stopCapturing = async () => {
    setIsCapturing(false);
    if (watchId.current) Geolocation.clearWatch(watchId.current);
    await saveWifiData();
    updateHeatmap();
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
        signalStrength: wifi.level,
        SSID: wifi.SSID,
        BSSID: wifi.BSSID,
      }));

      setWifiData(prevData => [...prevData, ...newWifiData]);
      setScanStatus('Idle');
    } catch (error) {
      setErrorMsg('Failed to scan WiFi: ' + error.message);
      setScanStatus('Error');
    }
  };

  const saveWifiData = async () => {
    try {
      await AsyncStorage.setItem('wifiData', JSON.stringify(wifiData));
    } catch (error) {
      console.error('Error saving WiFi data:', error);
    }
  };

  const updateHeatmap = () => {
    const newFloorPlanWifiData = {...floorPlanWifiData};
    if (!newFloorPlanWifiData[currentFloor]) {
      newFloorPlanWifiData[currentFloor] = Array(GRID_SIZE)
        .fill()
        .map(() => Array(GRID_SIZE).fill(0));
    }

    wifiData.forEach(data => {
      const gridX = Math.floor(
        (data.longitude - currentLocation.longitude) * 1000 + GRID_SIZE / 2,
      );
      const gridY = Math.floor(
        (data.latitude - currentLocation.latitude) * 1000 + GRID_SIZE / 2,
      );
      if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
        newFloorPlanWifiData[currentFloor][gridY][gridX] = Math.max(
          newFloorPlanWifiData[currentFloor][gridY][gridX],
          Math.abs(data.signalStrength),
        );
      }
    });

    setFloorPlanWifiData(newFloorPlanWifiData);
  };

  const updatePositionOnFloorPlan = (latitude, longitude) => {
    if (!floorPlanDimensions[currentFloor]) return;
    const {width, height} = floorPlanDimensions[currentFloor];
    setCurrentPositionOnFloorPlan({x: width / 2, y: height / 2});
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

  const markLocation = (x, y) => {
    if (isMarkingMode) {
      setMarkedLocations(prevLocations => ({
        ...prevLocations,
        [currentFloor]: [...(prevLocations[currentFloor] || []), {x, y}],
      }));
      setIsMarkingMode(false);
    }
  };

  const generateHeatmap = () => {
    const newFloorPlanWifiData = {...floorPlanWifiData};
    if (!newFloorPlanWifiData[currentFloor]) {
      newFloorPlanWifiData[currentFloor] = Array(GRID_SIZE)
        .fill()
        .map(() => Array(GRID_SIZE).fill(0));
    }

    const {width, height} = floorPlanDimensions[currentFloor];

    wifiData.forEach(data => {
      const gridX = Math.floor(
        ((data.longitude - currentLocation.longitude) / 0.0001) *
          (width / GRID_SIZE) +
          GRID_SIZE / 2,
      );
      const gridY = Math.floor(
        ((data.latitude - currentLocation.latitude) / 0.0001) *
          (height / GRID_SIZE) +
          GRID_SIZE / 2,
      );
      if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
        newFloorPlanWifiData[currentFloor][gridY][gridX] = Math.max(
          newFloorPlanWifiData[currentFloor][gridY][gridX],
          Math.abs(data.signalStrength),
        );
      }
    });

    setFloorPlanWifiData(newFloorPlanWifiData);
  };

  const renderHeatmap = () => {
    if (
      !floorPlans[currentFloor] ||
      !floorPlanWifiData[currentFloor] ||
      !floorPlanDimensions[currentFloor]
    )
      return null;

    const {width, height} = floorPlanDimensions[currentFloor];
    const cellWidth = width / GRID_SIZE;
    const cellHeight = height / GRID_SIZE;
    const maxIntensity = Math.max(
      ...floorPlanWifiData[currentFloor].flat().filter(v => !isNaN(v)),
    );

    return (
      <>
        {floorPlanWifiData[currentFloor].flatMap((row, y) =>
          row.map((intensity, x) => {
            if (isNaN(intensity) || intensity === 0) return null;
            const opacity = maxIntensity > 0 ? intensity / maxIntensity : 0;
            const rectX = x * cellWidth;
            const rectY = y * cellHeight;

            return (
              <Rect
                key={`${x}-${y}`}
                x={rectX}
                y={rectY}
                width={cellWidth}
                height={cellHeight}
                fill="red"
                opacity={opacity}
              />
            );
          }),
        )}
        {markedLocations[currentFloor]?.map((location, index) => (
          <Circle
            key={index}
            cx={location.x * width}
            cy={location.y * height}
            r={5}
            fill="blue"
          />
        ))}
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
            {/* <TouchableOpacity
              style={[styles.button, isMarkingMode && styles.activeButton]}
              onPress={() => setIsMarkingMode(!isMarkingMode)}>
              <Text style={styles.buttonText}>
                {isMarkingMode ? 'Cancel Marking' : 'Mark Location'}
              </Text>
            </TouchableOpacity> */}
            <TouchableOpacity style={styles.button} onPress={generateHeatmap}>
              <Text style={styles.buttonText}>Generate Heatmap</Text>
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
                  onPress={event => {
                    const {locationX, locationY} = event.nativeEvent;
                    const {width, height} = floorPlanDimensions[currentFloor];
                    markLocation(locationX / width, locationY / height);
                  }}
                  activeOpacity={1}>
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
});

export default App;
