import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  useColorScheme,
} from 'react-native';
import WifiManager from 'react-native-wifi-reborn';
import Geolocation from '@react-native-community/geolocation';
import {launchImageLibrary} from 'react-native-image-picker';
import Svg, {Rect, Circle, Path} from 'react-native-svg';
import {Picker} from '@react-native-picker/picker';
import ReactNativeZoomableView from '@openspacelabs/react-native-zoomable-view/src/ReactNativeZoomableView';
import {
  PaperProvider,
  Appbar,
  Card,
  Title,
  Paragraph,
  Button,
  Portal,
  Dialog,
  Text,
  useTheme,
} from 'react-native-paper';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';

const lightTheme = {
  colors: {
    primary: '#FFB6C1',
    secondary: '#FF69B4',
    background: '#FFFFFF',
    surface: '#F0F0F0',
    text: '#000000',
    disabled: '#CCCCCC',
    placeholder: '#888888',
    backdrop: 'rgba(0, 0, 0, 0.5)',
  },
};

const darkTheme = {
  colors: {
    primary: '#FF69B4',
    secondary: '#FFB6C1',
    background: '#121212',
    surface: '#1E1E1E',
    text: '#FFFFFF',
    disabled: '#666666',
    placeholder: '#AAAAAA',
    backdrop: 'rgba(0, 0, 0, 0.5)',
  },
};

const App = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
  const paperTheme = useTheme();

  const [wifiData, setWifiData] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorDialogVisible, setErrorDialogVisible] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [floorPlans, setFloorPlans] = useState({});
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [scanStatus, setScanStatus] = useState('Idle');
  const [isCapturing, setIsCapturing] = useState(false);
  const [floorPlanWifiData, setFloorPlanWifiData] = useState({});
  const [currentFloor, setCurrentFloor] = useState('1');
  const [isAddingFloor, setIsAddingFloor] = useState(false);
  const [newFloorName, setNewFloorName] = useState('');
  const [isWifiConnected, setIsWifiConnected] = useState(false);
  const [currentSSID, setCurrentSSID] = useState('');
  const [floorPlanDimensions, setFloorPlanDimensions] = useState({});
  const [markerPosition, setMarkerPosition] = useState(null);
  const [isMarkingMode, setIsMarkingMode] = useState(false);
  const [initialPosition, setInitialPosition] = useState(null);
  const [lastKnownLocation, setLastKnownLocation] = useState(null);
  const [lastUpdatedPosition, setLastUpdatedPosition] = useState(null);
  const [scanInterval, setScanInterval] = useState(null);

  const [signalStrength, setSignalStrength] = useState(0);
  const [sensitivity, setSensitivity] = useState(111319.9);

  const watchId = useRef(null);

  const setErrorMsgDialog = message => {
    setErrorDialogVisible(true);
    setErrorMsg(message);
  };

  const renderSignalStrengthMeter = () => {
    const radius = 50;
    const strokeWidth = 10;
    const normalizedStrength =
      Math.min(Math.max((signalStrength + 90) / 60, 0), 1) * Math.PI;

    const startAngle = -Math.PI;
    const endAngle = startAngle + normalizedStrength;

    const x1 = radius + (radius - strokeWidth / 2) * Math.cos(startAngle);
    const y1 = radius + (radius - strokeWidth / 2) * Math.sin(startAngle);
    const x2 = radius + (radius - strokeWidth / 2) * Math.cos(endAngle);
    const y2 = radius + (radius - strokeWidth / 2) * Math.sin(endAngle);

    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

    return (
      <View style={styles.signalMeterContainer}>
        <Svg height={radius * 2} width={radius * 2}>
          <Circle
            cx={radius}
            cy={radius}
            r={radius - strokeWidth / 2}
            stroke="#FFB6C1" // Light pink background
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Path
            d={`M${x1},${y1} A${radius - strokeWidth / 2},${
              radius - strokeWidth / 2
            } 0 ${largeArcFlag} 1 ${x2},${y2}`}
            stroke="#FF1493" // Dark pink fill color
            strokeWidth={strokeWidth}
            fill="none"
          />
        </Svg>
        <Text style={styles.signalStrengthText}>{signalStrength} dBm</Text>
      </View>
    );
  };

  useEffect(() => {
    const setup = async () => {
      await requestLocationPermission();
      checkWifiConnection();
      startLocationTracking();
    };

    setup();

    return () => {
      if (watchId.current) Geolocation.clearWatch(watchId.current);
      if (scanInterval) clearInterval(scanInterval);
    };
  }, []);

  useEffect(() => {
    if (isCapturing) {
      updateHeatmap(wifiData);
      const interval = setInterval(scanWifiAndUpdateHeatmap, 2000);
      setScanInterval(interval);
      return () => clearInterval(interval);
    }
  }, [wifiData, isCapturing]);

  useEffect(() => {
    if (lastKnownLocation && initialPosition) {
      updateMarkerPosition(
        lastKnownLocation.latitude,
        lastKnownLocation.longitude,
      );
    }
  }, [lastKnownLocation, initialPosition]);

  useEffect(() => {
    if (markerPosition && currentLocation && !initialPosition) {
      setInitialPosition(currentLocation);
    }
  }, [markerPosition, currentLocation]);

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
          setErrorMsgDialog('Location permission denied');
        }
      } catch (err) {
        console.warn(err);
        setErrorMsgDialog('Error requesting location permission');
      }
    }
  };

  const checkWifiConnection = async () => {
    try {
      const ssid = await WifiManager.getCurrentWifiSSID();
      setIsWifiConnected(!!ssid);
      setConnectedDevice(ssid || 'Not connected');
      setCurrentSSID(ssid || 'N/A');
      const level = await WifiManager.getCurrentSignalStrength();
      setSignalStrength(level);
    } catch (error) {
      console.error('Error checking WiFi connection:', error);
      setIsWifiConnected(false);
      setConnectedDevice('Not connected');
      setCurrentSSID('N/A');
      setSignalStrength(0);
    }
  };

  const startLocationTracking = () => {
    watchId.current = Geolocation.watchPosition(
      position => {
        const {latitude, longitude} = position.coords;
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

  const startCapturing = () => {
    if (!isWifiConnected) {
      setErrorMsgDialog('Please connect to a WiFi network before capturing.');
      return;
    }
    if (!markerPosition) {
      setErrorMsgDialog(
        'Please place a marker on the floor plan before capturing.',
      );
      return;
    }
    setIsCapturing(true);
    setWifiData([]);
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
      }));

      setWifiData(prevData => [...prevData, ...newWifiData]);
      setScanStatus('Idle');
    } catch (error) {
      setErrorMsgDialog('Failed to scan WiFi: ' + error.message);
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

  const updateMarkerPosition = (latitude, longitude) => {
    if (!initialPosition || !lastUpdatedPosition) {
      return;
    }

    const {width, height} = floorPlanDimensions[currentFloor] || {
      width: 300,
      height: 200,
    };

    // Calculate distance moved in meters
    const latDiff = latitude - lastUpdatedPosition.latitude;
    const lonDiff = longitude - lastUpdatedPosition.longitude;
    const distanceMovedLat = latDiff * sensitivity;
    const distanceMovedLon =
      lonDiff * sensitivity * Math.cos(latitude * (Math.PI / 180));

    const distanceMoved = Math.sqrt(
      distanceMovedLat ** 2 + distanceMovedLon ** 2,
    );

    const scaleFactor = 20;

    const pixelMovementX = distanceMovedLon * scaleFactor;
    const pixelMovementY = distanceMovedLat * scaleFactor;

    const newX = markerPosition.x + pixelMovementX;
    const newY = markerPosition.y - pixelMovementY;

    const clampedX = Math.max(0, Math.min(width, newX));
    const clampedY = Math.max(0, Math.min(height, newY));

    const smoothedPosition = smoothPosition(
      {x: clampedX, y: clampedY},
      markerPosition,
    );
    setMarkerPosition(smoothedPosition);

    setLastUpdatedPosition({latitude, longitude});

    console.log(`Distance moved: ${distanceMoved.toFixed(2)} meters`);
    console.log(
      `Pixel movement: X: ${pixelMovementX.toFixed(
        2,
      )}, Y: ${pixelMovementY.toFixed(2)}`,
    );
  };

  const smoothPosition = (newPos, oldPos, factor = 0.2) => {
    return {
      x: oldPos.x + (newPos.x - oldPos.x) * factor,
      y: oldPos.y + (newPos.y - oldPos.y) * factor,
    };
  };

  const handleFloorPlanPress = event => {
    if (isMarkingMode) {
      const {locationX, locationY} = event.nativeEvent;
      setMarkerPosition({x: locationX, y: locationY});
      setIsMarkingMode(false);
      if (lastKnownLocation) {
        setInitialPosition(lastKnownLocation);
        setLastUpdatedPosition(lastKnownLocation);
      }
    }
  };

  const renderMarker = () => {
    if (!markerPosition) return null;
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

  const interpolateSignalStrength = (x, y, dataPoints) => {
    const MAX_DISTANCE = 50;
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
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <Appbar.Header>
          <Appbar.Content title="WiFi Heatmap" />
        </Appbar.Header>
        <ScrollView
          style={[
            styles.container,
            {backgroundColor: theme.colors.background},
          ]}>
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.ssidText}>{currentSSID}</Text>
              <Text style={styles.connectedDeviceText}>Connected Device</Text>
              {renderSignalStrengthMeter()}
              <Button
                mode="contained"
                onPress={isCapturing ? stopCapturing : startCapturing}
                disabled={!isWifiConnected}
                style={[styles.button, isCapturing && styles.stopButton]}>
                {isCapturing ? 'Stop Capturing' : 'Start Capturing'}
              </Button>
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Title>Floor Plan Heatmap</Title>
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
                <Button
                  mode="contained"
                  onPress={() => setIsAddingFloor(true)}
                  style={styles.addFloorButton}>
                  +
                </Button>
              </View>
              <Button
                mode="contained"
                onPress={uploadFloorPlan}
                style={styles.button}>
                Upload Floor Plan
              </Button>
              <Button
                mode="contained"
                onPress={() => setIsMarkingMode(!isMarkingMode)}
                style={[styles.button, isMarkingMode && styles.activeButton]}>
                {isMarkingMode ? 'Cancel Marking' : 'Place Marker'}
              </Button>
              {floorPlans[currentFloor] && (
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
                          floorPlanDimensions[currentFloor],
                        ]}
                        resizeMode="contain"
                      />
                      <Svg
                        style={[
                          StyleSheet.absoluteFill,
                          floorPlanDimensions[currentFloor],
                        ]}>
                        {renderHeatmap()}
                      </Svg>
                      {renderMarker()}
                    </View>
                  </TouchableOpacity>
                </ReactNativeZoomableView>
              )}
              <Title style={styles.sensitivityTitle}>Heatmap Sensitivity</Title>
              <Slider
                value={sensitivity}
                onValueChange={value => setSensitivity(value)}
                minimumValue={50000}
                maximumValue={200000}
                step={1000}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={theme.colors.disabled}
                thumbTintColor={theme.colors.secondary}
              />
              <Text>Current Sensitivity: {sensitivity.toFixed(2)}</Text>
            </Card.Content>
          </Card>

          <Portal>
            <Dialog
              visible={isAddingFloor}
              onDismiss={() => setIsAddingFloor(false)}>
              <Dialog.Title>Add New Floor</Dialog.Title>
              <Dialog.Content>
                <TextInput
                  label="Floor Name or Number"
                  value={newFloorName}
                  onChangeText={setNewFloorName}
                  style={styles.input}
                />
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={() => setIsAddingFloor(false)}>Cancel</Button>
                <Button onPress={addNewFloor}>Add Floor</Button>
              </Dialog.Actions>
            </Dialog>
            <Dialog
              visible={errorDialogVisible}
              onDismiss={() => setErrorDialogVisible(false)}>
              <Dialog.Title>Error</Dialog.Title>
              <Dialog.Content>
                <Paragraph>{errorMsg}</Paragraph>
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={() => setErrorDialogVisible(false)}>OK</Button>
              </Dialog.Actions>
            </Dialog>
          </Portal>
        </ScrollView>
      </PaperProvider>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  card: {
    marginBottom: 10,
  },
  button: {
    marginTop: 10,
  },
  stopButton: {
    backgroundColor: '#FF3333',
  },
  floorPlan: {
    width: '100%',
    height: '100%',
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
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  input: {
    marginBottom: 15,
  },
  zoomableView: {
    width: '100%',
    height: 300,
  },
  activeButton: {
    backgroundColor: '#33CC33',
  },
  sensitivityTitle: {
    marginTop: 20,
  },
  ssidText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  connectedDeviceText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 5,
  },
  signalMeterContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  textContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
  },
  signalStrengthText: {
    fontSize: 16,
    position: 'absolute',
    top: '50%',
    left: '50%',
    fontWeight: 'bold',
    transform: [{translateX: -30}, {translateY: -10}],
  },
});

export default App;
