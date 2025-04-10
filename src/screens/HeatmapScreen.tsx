import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {View, StyleSheet, ScrollView, Text} from 'react-native';
import {
  Card,
  Title,
  Button,
  Dialog,
  Portal,
  Paragraph,
  TextInput,
} from 'react-native-paper';
import {Picker} from '@react-native-picker/picker';
import Slider from '@react-native-community/slider';
import FloorPlanHeatmap from '../components/FloorPlanHeatmap';
import WifiService, {WifiDataPoint} from '../services/WifiService';
import LocationService, {LocationData} from '../services/LocationService';
import {HeatmapDataPoint, smoothPosition} from '../utils/HeatmapUtils';
import {useTheme} from '../theme/ThemeProvider';
import {globalStyles} from '../theme/styles';
import {useSettings} from '../context/SettingsContext';

const HeatmapScreen = () => {
  const theme = useTheme();
  const {
    sensitivity,
    autoScan,
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
  const [scanInterval, setScanInterval] = useState<NodeJS.Timeout | null>(null);
  const [scanStatus, setScanStatus] = useState('Idle');

  // Add a ref to track if the component is mounted
  const isMounted = useRef(true);

  // Optimize the scan interval timing based on performance
  const [scanIntervalTime, setScanIntervalTime] = useState(3000);

  // Update scan interval when settings change
  useEffect(() => {
    setScanIntervalTime(settingsScanInterval);
  }, [settingsScanInterval]);

  // Update location accuracy when settings change
  useEffect(() => {
    LocationService.setHighAccuracy(highAccuracy);
  }, [highAccuracy]);

  useEffect(() => {
    const setup = async () => {
      await WifiService.requestLocationPermission();
      startLocationTracking();
    };

    setup();

    return () => {
      isMounted.current = false;
      LocationService.stopLocationTracking();
      if (scanInterval) clearInterval(scanInterval);
    };
  }, []);

  // Use useCallback to prevent recreation of this function on each render
  const scanWifiAndUpdateHeatmap = useCallback(async () => {
    if (!markerPosition || !initialPosition || !isMounted.current) return;
    if (!autoScan) return; // Skip scanning if autoScan is disabled

    try {
      setScanStatus('Detecting');
      const wifiList = await WifiService.scanWifiNetworks();

      if (!isMounted.current) return;

      const newWifiData = wifiList.map(wifi => ({
        x: markerPosition.x,
        y: markerPosition.y,
        signalStrength: wifi.level,
        SSID: wifi.SSID,
      }));

      setWifiData(prevData => [...prevData, ...newWifiData]);
      setScanStatus('Idle');
    } catch (error) {
      if (isMounted.current) {
        setErrorMsgDialog('Failed to scan WiFi: ' + error.message);
        setScanStatus('Error');
      }
    }
  }, [markerPosition, initialPosition, autoScan]);

  // Use useEffect with proper dependencies
  useEffect(() => {
    if (isCapturing) {
      updateHeatmap(wifiData);
      const interval = setInterval(scanWifiAndUpdateHeatmap, scanIntervalTime);
      setScanInterval(interval);
      return () => clearInterval(interval);
    }
  }, [wifiData, isCapturing, scanWifiAndUpdateHeatmap, scanIntervalTime]);

  useEffect(() => {
    if (lastKnownLocation && initialPosition) {
      updateMarkerPosition(
        lastKnownLocation.latitude,
        lastKnownLocation.longitude,
      );
    }
  }, [lastKnownLocation, initialPosition]);

  useEffect(() => {
    if (markerPosition && lastKnownLocation && !initialPosition) {
      setInitialPosition(lastKnownLocation);
      setLastUpdatedPosition(lastKnownLocation);
    }
  }, [markerPosition, lastKnownLocation]);

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
    if (scanInterval) {
      clearInterval(scanInterval);
      setScanInterval(null);
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
        });
      });

      return updatedData;
    });
  };

  const updateMarkerPosition = (latitude: number, longitude: number) => {
    if (!initialPosition || !lastUpdatedPosition || !markerPosition) {
      return;
    }

    const {width, height} = floorPlanDimensions[currentFloor] || {
      width: 300,
      height: 200,
    };

    // Calculate distance moved in meters
    const latDiff = latitude - lastUpdatedPosition.latitude;
    const lonDiff = longitude - lastUpdatedPosition.longitude;

    // Convert user-friendly sensitivity (0-100) to actual calculation value
    const actualSensitivity = 50000 + sensitivity * 1500;

    const distanceMovedLat = latDiff * actualSensitivity;
    const distanceMovedLon =
      lonDiff * actualSensitivity * Math.cos(latitude * (Math.PI / 180));

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

  const addNewFloor = () => {
    if (newFloorName.trim() !== '') {
      setFloorPlans(prevPlans => ({...prevPlans, [newFloorName]: 'blank'}));
      setFloorPlanDimensions(prevDimensions => ({
        ...prevDimensions,
        [newFloorName]: {width: 500, height: 500},
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
      [blankFloorName]: {width: 500, height: 500},
    }));
    setCurrentFloor(blankFloorName);
  };

  const renderFloorPlanContent = () => {
    if (!floorPlans[currentFloor]) {
      return (
        <View style={styles.uploadPromptContainer}>
          <Paragraph
            style={{
              color: theme.colors.text,
              textAlign: 'center',
              marginBottom: 16,
            }}>
            Create a blank floor plan to get started
          </Paragraph>
          <Button
            mode="contained"
            onPress={createBlankFloorPlan}
            style={[
              globalStyles.button,
              {backgroundColor: theme.colors.accent},
            ]}>
            Create Blank Floor Plan
          </Button>
        </View>
      );
    }

    return (
      <View style={styles.floorPlanContainer}>
        <FloorPlanHeatmap
          floorPlanDimensions={
            floorPlanDimensions[currentFloor] || {width: 500, height: 500}
          }
          heatmapData={floorPlanWifiData[currentFloor] || []}
          markerPosition={markerPosition}
          isMarkingMode={isMarkingMode}
          onFloorPlanPress={handleFloorPlanPress}
        />
      </View>
    );
  };

  // Memoize the floor plan content to prevent unnecessary re-renders
  const floorPlanContent = useMemo(
    () => renderFloorPlanContent(),
    [
      floorPlans,
      currentFloor,
      floorPlanWifiData,
      markerPosition,
      isMarkingMode,
      floorPlanDimensions,
    ],
  );

  return (
    <ScrollView
      style={[
        globalStyles.container,
        {backgroundColor: theme.colors.background},
      ]}>
      <Card
        style={[globalStyles.card, {backgroundColor: theme.colors.surface}]}>
        <Card.Content>
          <Title style={{color: theme.colors.text}}>WiFi Heatmap Capture</Title>

          <Button
            mode="contained"
            onPress={isCapturing ? stopCapturing : startCapturing}
            style={[
              globalStyles.button,
              isCapturing
                ? {backgroundColor: theme.colors.error}
                : {backgroundColor: theme.colors.primary},
            ]}>
            {isCapturing ? 'Stop Capturing' : 'Start Capturing'}
          </Button>

          {scanStatus !== 'Idle' && (
            <Paragraph
              style={{color: theme.colors.textSecondary, marginTop: 8}}>
              Status: {scanStatus}
            </Paragraph>
          )}
        </Card.Content>
      </Card>

      <Card
        style={[globalStyles.card, {backgroundColor: theme.colors.surface}]}>
        <Card.Content>
          <Title style={{color: theme.colors.text}}>Floor Plan</Title>

          <View style={styles.floorSelection}>
            <Picker
              selectedValue={currentFloor}
              style={[styles.picker, {color: theme.colors.text}]}
              onValueChange={itemValue => setCurrentFloor(itemValue)}>
              {Object.keys(floorPlans).map(floor => (
                <Picker.Item
                  key={floor}
                  label={`Floor ${floor}`}
                  value={floor}
                  color={theme.colors.text}
                />
              ))}
            </Picker>
            <Button
              mode="contained"
              onPress={() => setIsAddingFloor(true)}
              style={[
                styles.addFloorButton,
                {backgroundColor: theme.colors.primary},
              ]}>
              +
            </Button>
          </View>

          <Button
            mode="contained"
            onPress={() => setIsMarkingMode(!isMarkingMode)}
            style={[
              globalStyles.button,
              isMarkingMode
                ? {backgroundColor: theme.colors.accent}
                : {backgroundColor: theme.colors.primary},
            ]}>
            {isMarkingMode ? 'Cancel Marking' : 'Place Marker'}
          </Button>

          <View style={styles.floorPlanWrapper}>{floorPlanContent}</View>

          <View style={styles.sensitivityContainer}>
            <Title
              style={{
                color: theme.colors.text,
                marginTop: 16,
                marginBottom: 8,
              }}>
              Movement Sensitivity
            </Title>
            <Slider
              value={sensitivity}
              onValueChange={() => {
                // This is now handled by the settings context
                // setSensitivity(value);
              }}
              minimumValue={0}
              maximumValue={100}
              step={1}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor={theme.colors.disabled}
              thumbTintColor={theme.colors.accent}
              style={styles.slider}
            />
            <Text
              style={{
                color: theme.colors.text,
                textAlign: 'center',
                marginTop: 4,
              }}>
              Sensitivity: {sensitivity.toFixed(0)}
            </Text>
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
  );
};

const styles = StyleSheet.create({
  floorSelection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  picker: {
    flex: 1,
    height: 50,
  },
  addFloorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  floorPlanWrapper: {
    marginTop: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  floorPlanContainer: {
    width: '100%',
    height: 400,
    borderWidth: 1,
    borderColor: '#ccc',
    overflow: 'hidden',
  },
  uploadPromptContainer: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  sensitivityContainer: {
    marginTop: 16,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  input: {
    marginVertical: 8,
  },
});

export default HeatmapScreen;
