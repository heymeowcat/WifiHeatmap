import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Text, Button, Title } from 'react-native-paper';
import SignalStrengthMeter from '../components/SignalStrengthMeter';
import WifiService from '../services/WifiService';
import { useTheme } from '../theme/ThemeProvider';
import { globalStyles } from '../theme/styles';

const HomeScreen = ({ navigation }) => {
  const theme = useTheme();
  const [isWifiConnected, setIsWifiConnected] = useState(false);
  const [currentSSID, setCurrentSSID] = useState('Not connected');
  const [signalStrength, setSignalStrength] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const checkWifiConnection = async () => {
      try {
        const hasPermission = await WifiService.requestLocationPermission();
        if (hasPermission) {
          updateWifiInfo();
        }
      } catch (error) {
        console.error('Error during setup:', error);
      }
    };

    checkWifiConnection();
    const interval = setInterval(updateWifiInfo, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const updateWifiInfo = async () => {
    try {
      const { ssid, strength } = await WifiService.getCurrentWifiInfo();
      setIsWifiConnected(ssid !== 'Not connected');
      setCurrentSSID(ssid);
      setSignalStrength(strength);
    } catch (error) {
      console.error('Error updating WiFi info:', error);
    }
  };

  const handleScanWifi = async () => {
    if (isScanning) return;
    
    setIsScanning(true);
    try {
      await WifiService.scanWifiNetworks();
      await updateWifiInfo();
    } catch (error) {
      console.error('Error scanning WiFi:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleStartMapping = () => {
    if (!isWifiConnected) {
      // Show error or alert
      return;
    }
    navigation.navigate('Heatmap');
  };

  return (
    <ScrollView style={[globalStyles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={[globalStyles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Content>
          <Title style={{ color: theme.colors.text }}>WiFi Connection</Title>
          <Text style={{ color: theme.colors.textSecondary, marginBottom: 8 }}>
            Current connection status
          </Text>
          
          <View style={styles.connectionInfo}>
            <Text style={[styles.ssidText, { color: theme.colors.text }]}>
              {currentSSID}
            </Text>
            <Text style={[styles.connectionStatus, { color: theme.colors.textSecondary }]}>
              {isWifiConnected ? 'Connected' : 'Not Connected'}
            </Text>
          </View>
          
          <SignalStrengthMeter signalStrength={signalStrength} />
          
          <Button
            mode="contained"
            onPress={handleScanWifi}
            loading={isScanning}
            disabled={isScanning}
            style={[globalStyles.button, { backgroundColor: theme.colors.primary }]}
          >
            {isScanning ? 'Scanning...' : 'Scan WiFi Networks'}
          </Button>
        </Card.Content>
      </Card>

      <Card style={[globalStyles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Content>
          <Title style={{ color: theme.colors.text }}>WiFi Heatmap</Title>
          <Text style={{ color: theme.colors.textSecondary, marginBottom: 16 }}>
            Create and view WiFi signal heatmaps
          </Text>
          
          <Button
            mode="contained"
            onPress={handleStartMapping}
            disabled={!isWifiConnected}
            style={[globalStyles.button, { backgroundColor: theme.colors.accent }]}
          >
            Start Mapping
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  connectionInfo: {
    marginVertical: 16,
  },
  ssidText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  connectionStatus: {
    fontSize: 16,
  },
});

export default HomeScreen;