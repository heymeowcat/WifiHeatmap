import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  Dimensions,
} from 'react-native';
import {
  Button,
  Card,
  Title,
  Paragraph,
  Dialog,
  Portal,
  TextInput,
  useTheme,
} from 'react-native-paper';
import {Picker} from '@react-native-picker/picker';
import Slider from '@react-native-community/slider';
import SkiaHeatmap from '../components/SkiaHeatmap';
import Heatmap3D from '../components/Heatmap3D';
import {WifiDataPoint, HeatmapDataPoint, LocationData} from '../types/heatmap';
import {useSettings} from '../context/SettingsContext';
import {WifiService, LocationService} from '../services';
import {NativeModules} from 'react-native';
import {globalStyles} from '../theme/styles';

// Check if WifiRtt is available and provide a fallback
const {WifiRtt} = NativeModules;

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const AUTO_UPDATE_INTERVAL = 5000;

const scanWifiNetworks = async () => {
  try {
    return await WifiService.scanWifiNetworks();
  } catch (error) {
    console.error('Error scanning WiFi networks:', error);
    // Return empty array instead of throwing
    return [];
  }
};

const startRanging = async (bssid: string) => {
  try {
    if (!WifiRtt) {
      console.warn('WifiRtt module not available, skipping ranging');
      return null;
    }
    return await WifiRtt.startRanging(bssid);
  } catch (error) {
    console.error('Error starting ranging:', error);
    return null;
  }
};

const startMultipleRanging = async () => {
  try {
    if (!WifiRtt) {
      console.warn('WifiRtt module not available, skipping multiple ranging');
      return [];
    }
    return await WifiRtt.startMultipleRanging();
  } catch (error) {
    console.error('Error starting multiple ranging:', error);
    return [];
  }
};

const HeatmapScreen = () => {
  const theme = useTheme();
  const {
    sensitivity,
    highAccuracy,
    scanInterval: settingsScanInterval,
  } = useSettings();

  const [wifiData, setWifiData] = useState<WifiDataPoint[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorDialogVisible, setErrorDialogVisible] = useState(false);
  const [floorPlans, setFloorPlans] = useState<Record<string, string>>({});
  const [isCapturing, setIsCapturing] = useState(false);
  const [floorPlanWifiData, setFloorPlanWifiData] = useState<
    Record<string, HeatmapDataPoint[]>
  >({});
  const [currentFloor, setCurrentFloor] = useState('1');
  const [isAddingFloor, setIsAddingFloor] = useState(false);
  const [newFloorName, setNewFloorName] = useState('');
  const [floorPlanDimensions, setFloorPlanDimensions] = useState<
    Record<string, {width: number; height: number}>
  >({});
  const [markerPosition, setMarkerPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isMarkingMode, setIsMarkingMode] = useState(false);
  const [initialPosition, setInitialPosition] = useState<LocationData | null>(
    null,
  );
  const [lastKnownLocation, setLastKnownLocation] =
    useState<LocationData | null>(null);
  const [lastUpdatedPosition, setLastUpdatedPosition] =
    useState<LocationData | null>(null);
  const [scanStatus, setScanStatus] = useState('Idle');
  const [isAutoUpdate, setIsAutoUpdate] = useState(false);
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');
  const autoUpdateTimer = useRef<NodeJS.Timeout | null>(null);

  const isMounted = useRef(true);

  useEffect(() => {
    const setup = async () => {
      await WifiService.requestLocationPermission();
      startLocationTracking();

      try {
        // Check if RTT is available using the service instead
        const isRttAvailable = await WifiService.isRttAvailable();
        console.log('RTT available:', isRttAvailable);
      } catch (error) {
        console.error('Error checking RTT availability:', error);
      }
    };
    setup();
    return () => {
      isMounted.current = false;
      LocationService.stopLocationTracking();
      if (autoUpdateTimer.current) clearInterval(autoUpdateTimer.current);
    };
  }, []);

  useEffect(() => {
    LocationService.setHighAccuracy(highAccuracy);
  }, [highAccuracy]);

  useEffect(() => {
    if (isAutoUpdate && isCapturing) {
      autoUpdateTimer.current = setInterval(() => {
        handleAddDataPoint();
      }, AUTO_UPDATE_INTERVAL);
    } else if (autoUpdateTimer.current) {
      clearInterval(autoUpdateTimer.current);
      autoUpdateTimer.current = null;
    }
    return () => {
      if (autoUpdateTimer.current) {
        clearInterval(autoUpdateTimer.current);
        autoUpdateTimer.current = null;
      }
    };
  }, [isAutoUpdate, isCapturing, markerPosition, initialPosition]);

  const startLocationTracking = () => {
    LocationService.startLocationTracking(
      location => {
        setLastKnownLocation(location);
      },
      error => {
        console.log('Error watching position:', error);
      },
    );
  };

  const startCapturing = () => {
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
    if (autoUpdateTimer.current) {
      clearInterval(autoUpdateTimer.current);
      autoUpdateTimer.current = null;
    }
  };

  const updateHeatmap = (newData: WifiDataPoint[]) => {
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
          distance: data.distance,
          quality: data.quality,
        });
      });
      return updatedData;
    });
  };

  const setErrorMsgDialog = (message: string) => {
    setErrorDialogVisible(true);
    setErrorMsg(message);
  };

  const handleFloorPlanPress = (locationX: number, locationY: number) => {
    if (isMarkingMode) {
      setMarkerPosition({x: locationX, y: locationY});
      setIsMarkingMode(false);
      if (lastKnownLocation) {
        setInitialPosition(lastKnownLocation);
        setLastUpdatedPosition(lastKnownLocation);
      }
    }
  };

  const handleAddDataPoint = async () => {
    if (!isCapturing || !markerPosition) {
      return;
    }

    setScanStatus('Scanning...');
    try {
      const networks = await scanWifiNetworks();
      
      // Handle case when networks is empty
      if (!networks || networks.length === 0) {
        setScanStatus('No networks found');
        return;
      }

      const rttCapableAPs = networks.filter(ap => ap.is80211mcResponder);

      let bestSignalStrength = -100;
      let bestDistance = null;
      let signalQuality = 0;

      if (rttCapableAPs.length > 0) {
        try {
          const rangingResults = await startMultipleRanging();

          if (rangingResults && rangingResults.length > 0) {
            const bestResult = rangingResults.reduce((best, current) => {
              return current.signalQuality > best.signalQuality
                ? current
                : best;
            }, rangingResults[0]);

            bestSignalStrength = bestResult.rssi;
            bestDistance = bestResult.distanceMm / 1000;
            signalQuality = bestResult.signalQuality;
          }
        } catch (error) {
          console.log('RTT ranging failed, falling back to RSSI:', error);
        }
      }

      if (bestSignalStrength === -100 && networks.length > 0) {
        const strongestAP = networks.reduce((strongest, current) => {
          return current.level > strongest.level ? current : strongest;
        }, networks[0]);

        bestSignalStrength = strongestAP.level;
      }

      const newDataPoint: WifiDataPoint = {
        x: markerPosition.x,
        y: markerPosition.y,
        signalStrength: bestSignalStrength,
        distance: bestDistance,
        quality: signalQuality,
        timestamp: new Date().toISOString(),
      };

      setWifiData(prevData => [...prevData, newDataPoint]);
      updateHeatmap([newDataPoint]);
      setScanStatus(
        `Signal: ${bestSignalStrength} dBm${
          bestDistance ? `, Distance: ${bestDistance.toFixed(2)}m` : ''
        }`,
      );
    } catch (error) {
      console.error('Error adding data point:', error);
      setScanStatus('Scan failed');
      setErrorMsgDialog(`Failed to scan WiFi: ${error.message}`);
    }
  };

  const addNewFloor = () => {
    if (newFloorName.trim() !== '') {
      setFloorPlans(prevPlans => ({...prevPlans, [newFloorName]: 'blank'}));
      setFloorPlanDimensions(prevDimensions => ({
        ...prevDimensions,
        [newFloorName]: {width: CANVAS_WIDTH, height: CANVAS_HEIGHT},
      }));
      setCurrentFloor(newFloorName);
      setNewFloorName('');
      setIsAddingFloor(false);
    }
  };

  const createBlankFloorPlan = () => {
    const blankFloorName = `Floor ${Object.keys(floorPlans).length + 1}`;
    setFloorPlans(prevPlans => ({...prevPlans, [blankFloorName]: 'blank'}));
    setFloorPlanDimensions(prevDimensions => ({
      ...prevDimensions,
      [blankFloorName]: {width: CANVAS_WIDTH, height: CANVAS_HEIGHT},
    }));
    setCurrentFloor(blankFloorName);
  };

  const toggleViewMode = () => {
    setViewMode(prevMode => (prevMode === '2D' ? '3D' : '2D'));
  };

  const currentDimensions = floorPlanDimensions[currentFloor] || {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  };

  const currentFloorData = floorPlanWifiData[currentFloor] || [];

  const renderHeatmap = () => {
    if (viewMode === '3D') {
      return (
        <Heatmap3D
          width={currentDimensions.width}
          height={currentDimensions.height}
          data={currentFloorData}
          floorPlanDimensions={currentDimensions}
        />
      );
    } else {
      return (
        <SkiaHeatmap
          width={currentDimensions.width}
          height={currentDimensions.height}
          data={currentFloorData}
          floorPlanImage={
            floorPlans[currentFloor] !== 'blank'
              ? floorPlans[currentFloor]
              : null
          }
          markerPosition={markerPosition}
          onPress={handleFloorPlanPress}
        />
      );
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>WiFi Heatmap</Title>
          <View style={styles.controlsContainer}>
            <View style={styles.pickerContainer}>
              <Text>Floor:</Text>
              <Picker
                selectedValue={currentFloor}
                style={styles.picker}
                onValueChange={itemValue =>
                  setCurrentFloor(itemValue.toString())
                }>
                {Object.keys(floorPlans).map(floor => (
                  <Picker.Item key={floor} label={floor} value={floor} />
                ))}
              </Picker>
            </View>
            <Button
              mode="outlined"
              onPress={() => setIsAddingFloor(true)}
              style={styles.button}>
              Add Floor
            </Button>
            <Button
              mode="outlined"
              onPress={createBlankFloorPlan}
              style={styles.button}>
              Create Blank
            </Button>
          </View>

          <View style={styles.viewModeContainer}>
            <Text>View Mode: {viewMode}</Text>
            <Button
              mode="contained"
              onPress={toggleViewMode}
              style={styles.button}>
              Toggle {viewMode === '2D' ? '3D' : '2D'} View
            </Button>
          </View>

          <View style={styles.heatmapContainer}>{renderHeatmap()}</View>

          <View style={styles.controlsContainer}>
            <Button
              mode="contained"
              onPress={() => setIsMarkingMode(true)}
              style={styles.button}
              disabled={isCapturing}>
              Place Marker
            </Button>
            <Button
              mode="contained"
              onPress={isCapturing ? stopCapturing : startCapturing}
              style={[
                styles.button,
                {
                  backgroundColor: isCapturing
                    ? theme.colors.error
                    : theme.colors.primary,
                },
              ]}>
              {isCapturing ? 'Stop Capturing' : 'Start Capturing'}
            </Button>
            <Button
              mode="contained"
              onPress={handleAddDataPoint}
              style={styles.button}
              disabled={!isCapturing || !markerPosition}>
              Add Data Point
            </Button>
          </View>

          <View style={styles.statusContainer}>
            <Text>Status: {scanStatus}</Text>
            <View style={styles.switchContainer}>
              <Text>Auto Update:</Text>
              <Switch
                value={isAutoUpdate}
                onValueChange={setIsAutoUpdate}
                disabled={!isCapturing}
              />
            </View>
          </View>

          <View style={styles.dataPointsContainer}>
            <Title>Data Points</Title>
            {wifiData.map((data, index) => (
              <View key={index} style={styles.dataPoint}>
                <Text>
                  Position: ({data.x.toFixed(0)}, {data.y.toFixed(0)})
                </Text>
                <Text>Signal Strength: {data.signalStrength} dBm</Text>
                {data.distance && (
                  <Text>Distance: {data.distance.toFixed(2)} m</Text>
                )}
                {data.quality && (
                  <Text>Quality: {(data.quality * 100).toFixed(0)}%</Text>
                )}
              </View>
            ))}
          </View>
        </Card.Content>
      </Card>

      <Portal>
        <Dialog
          visible={isAddingFloor}
          onDismiss={() => setIsAddingFloor(false)}>
          <Dialog.Title>Add New Floor</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Floor Name"
              value={newFloorName}
              onChangeText={setNewFloorName}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsAddingFloor(false)}>Cancel</Button>
            <Button onPress={addNewFloor}>Add</Button>
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
    flexWrap: 'wrap',
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  picker: {
    width: 150,
    height: 50,
  },
  button: {
    marginHorizontal: 4,
  },
  heatmapContainer: {
    marginVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    overflow: 'hidden',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dataPointsContainer: {
    marginTop: 16,
  },
  dataPoint: {
    padding: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    marginVertical: 4,
  },
  viewModeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
});

export default HeatmapScreen;
