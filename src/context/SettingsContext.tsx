import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsContextType {
  sensitivity: number;
  setSensitivity: (value: number) => void;
  autoScan: boolean;
  setAutoScan: (value: boolean) => void;
  highAccuracy: boolean;
  setHighAccuracy: (value: boolean) => void;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  scanInterval: number;
  setScanInterval: (value: number) => void;
}

const defaultSettings = {
  sensitivity: 50,
  autoScan: true,
  highAccuracy: true,
  darkMode: false,
  scanInterval: 3000,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [sensitivity, setSensitivityState] = useState(defaultSettings.sensitivity);
  const [autoScan, setAutoScanState] = useState(defaultSettings.autoScan);
  const [highAccuracy, setHighAccuracyState] = useState(defaultSettings.highAccuracy);
  const [darkMode, setDarkModeState] = useState(defaultSettings.darkMode);
  const [scanInterval, setScanIntervalState] = useState(defaultSettings.scanInterval);

  // Load settings from storage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await AsyncStorage.getItem('appSettings');
        if (storedSettings) {
          const settings = JSON.parse(storedSettings);
          setSensitivityState(settings.sensitivity ?? defaultSettings.sensitivity);
          setAutoScanState(settings.autoScan ?? defaultSettings.autoScan);
          setHighAccuracyState(settings.highAccuracy ?? defaultSettings.highAccuracy);
          setDarkModeState(settings.darkMode ?? defaultSettings.darkMode);
          setScanIntervalState(settings.scanInterval ?? defaultSettings.scanInterval);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Save settings to storage when they change
  const saveSettings = async (settings: Partial<typeof defaultSettings>) => {
    try {
      const currentSettings = await AsyncStorage.getItem('appSettings');
      const parsedSettings = currentSettings ? JSON.parse(currentSettings) : {};
      const newSettings = { ...parsedSettings, ...settings };
      await AsyncStorage.setItem('appSettings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const setSensitivity = (value: number) => {
    setSensitivityState(value);
    saveSettings({ sensitivity: value });
  };

  const setAutoScan = (value: boolean) => {
    setAutoScanState(value);
    saveSettings({ autoScan: value });
  };

  const setHighAccuracy = (value: boolean) => {
    setHighAccuracyState(value);
    saveSettings({ highAccuracy: value });
  };

  const setDarkMode = (value: boolean) => {
    setDarkModeState(value);
    saveSettings({ darkMode: value });
  };

  const setScanInterval = (value: number) => {
    setScanIntervalState(value);
    saveSettings({ scanInterval: value });
  };

  return (
    <SettingsContext.Provider
      value={{
        sensitivity,
        setSensitivity,
        autoScan,
        setAutoScan,
        highAccuracy,
        setHighAccuracy,
        darkMode,
        setDarkMode,
        scanInterval,
        setScanInterval,
      }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};