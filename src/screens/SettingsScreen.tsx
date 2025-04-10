import React from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { Card, Title, Button, Divider, Switch } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { useTheme } from '../theme/ThemeProvider';
import { useSettings } from '../context/SettingsContext';
import { globalStyles } from '../theme/styles';

const SettingsScreen = () => {
  const theme = useTheme();
  const {
    sensitivity,
    setSensitivity,
    autoScan,
    setAutoScan,
    highAccuracy,
    setHighAccuracy,
    darkMode,
    setDarkMode,
  } = useSettings();

  return (
    <ScrollView
      style={[
        globalStyles.container,
        {backgroundColor: theme.colors.background},
      ]}>
      <Card
        style={[globalStyles.card, {backgroundColor: theme.colors.surface}]}>
        <Card.Content>
          <Title style={{color: theme.colors.text}}>Location Settings</Title>

          <View style={styles.settingRow}>
            <Text style={{color: theme.colors.text}}>Movement Sensitivity</Text>
            <Slider
              value={sensitivity}
              onValueChange={setSensitivity}
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
                color: theme.colors.textSecondary,
                alignSelf: 'flex-end',
              }}>
              {sensitivity.toFixed(0)}
            </Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.settingRow}>
            <Text style={{color: theme.colors.text}}>High Accuracy Mode</Text>
            <Switch
              value={highAccuracy}
              onValueChange={setHighAccuracy}
              color={theme.colors.primary}
            />
          </View>

          <Text
            style={{
              color: theme.colors.textSecondary,
              marginTop: 4,
              fontSize: 12,
            }}>
            Uses more battery but provides more accurate positioning
          </Text>
        </Card.Content>
      </Card>

      <Card
        style={[globalStyles.card, {backgroundColor: theme.colors.surface}]}>
        <Card.Content>
          <Title style={{color: theme.colors.text}}>WiFi Scanning</Title>

          <View style={styles.settingRow}>
            <Text style={{color: theme.colors.text}}>Auto-scan WiFi Networks</Text>
            <Switch
              value={autoScan}
              onValueChange={setAutoScan}
              color={theme.colors.primary}
            />
          </View>

          <Text
            style={{
              color: theme.colors.textSecondary,
              marginTop: 4,
              fontSize: 12,
            }}>
            Automatically scan for WiFi networks when capturing
          </Text>
        </Card.Content>
      </Card>

      <Card
        style={[globalStyles.card, {backgroundColor: theme.colors.surface}]}>
        <Card.Content>
          <Title style={{color: theme.colors.text}}>Appearance</Title>

          <View style={styles.settingRow}>
            <Text style={{color: theme.colors.text}}>Dark Mode</Text>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              color={theme.colors.primary}
            />
          </View>

          <Text
            style={{
              color: theme.colors.textSecondary,
              marginTop: 4,
              fontSize: 12,
            }}>
            Toggle between light and dark theme
          </Text>
        </Card.Content>
      </Card>

      <Card
        style={[
          globalStyles.card,
          {backgroundColor: theme.colors.surface, marginBottom: 24},
        ]}>
        <Card.Content>
          <Title style={{color: theme.colors.text}}>About</Title>
          <Text style={{color: theme.colors.textSecondary, marginTop: 8}}>
            WiFi Heatmap v1.0.0
          </Text>
          <Text style={{color: theme.colors.textSecondary, marginTop: 4}}>
            Create detailed WiFi signal strength maps
          </Text>

          <Button
            mode="outlined"
            onPress={() => {}}
            style={[
              globalStyles.button,
              {marginTop: 16, borderColor: theme.colors.primary},
            ]}
            labelStyle={{color: theme.colors.primary}}>
            Privacy Policy
          </Button>

          <Button
            mode="outlined"
            onPress={() => {}}
            style={[globalStyles.button, {borderColor: theme.colors.primary}]}
            labelStyle={{color: theme.colors.primary}}>
            Terms of Service
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  slider: {
    flex: 1,
    marginHorizontal: 16,
  },
  divider: {
    marginVertical: 16,
  },
});

export default SettingsScreen;
