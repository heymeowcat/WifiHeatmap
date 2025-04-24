import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsContextType {
  sensitivity: number;
  setSensitivity: (value: number) => void;
  highAccuracy: boolean;
  setHighAccuracy: (value: boolean) => void;
  scanInterval: number;
  setScanInterval: (value: number) => void;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

const defaultSettings: Omit<SettingsContextType, 'setSensitivity' | 'setHighAccuracy' | 'setScanInterval' | 'setDarkMode'> = {
  sensitivity: 50,
  highAccuracy: true,
  scanInterval: 5000,
  darkMode: false,
};

const SettingsContext = createContext<SettingsContextType>({
  ...defaultSettings,
  setSensitivity: () => {},
  setHighAccuracy: () => {},
  setScanInterval: () => {},
  setDarkMode: () => {},
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [sensitivity, setSensitivity] = useState(defaultSettings.sensitivity);
  const [highAccuracy, setHighAccuracy] = useState(defaultSettings.highAccuracy);
  const [scanInterval, setScanInterval] = useState(defaultSettings.scanInterval);
  const [darkMode, setDarkMode] = useState(defaultSettings.darkMode);

  // Load settings from AsyncStorage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await AsyncStorage.getItem('settings');
        if (storedSettings) {
          const parsedSettings = JSON.parse(storedSettings);
          setSensitivity(parsedSettings.sensitivity ?? defaultSettings.sensitivity);
          setHighAccuracy(parsedSettings.highAccuracy ?? defaultSettings.highAccuracy);
          setScanInterval(parsedSettings.scanInterval ?? defaultSettings.scanInterval);
          setDarkMode(parsedSettings.darkMode ?? defaultSettings.darkMode);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Save settings to AsyncStorage when they change
  useEffect(() => {
    const saveSettings = async () => {
      try {
        const settings = {
          sensitivity,
          highAccuracy,
          scanInterval,
          darkMode,
        };
        await AsyncStorage.setItem('settings', JSON.stringify(settings));
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
    };

    saveSettings();
  }, [sensitivity, highAccuracy, scanInterval, darkMode]);

  return (
    <SettingsContext.Provider
      value={{
        sensitivity,
        setSensitivity,
        highAccuracy,
        setHighAccuracy,
        scanInterval,
        setScanInterval,
        darkMode,
        setDarkMode,
      }}>
      {children}
    </SettingsContext.Provider>
  );
};