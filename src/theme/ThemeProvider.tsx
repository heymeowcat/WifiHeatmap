import React, {createContext, useContext, useEffect, useState} from 'react';
import {useColorScheme} from 'react-native';
import {colors} from './colors';
import {useSettings} from '../context/SettingsContext';

// Define theme types
export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  error: string;
  text: string;
  textSecondary: string;
  border: string;
  disabled: string;
}

export interface ThemeType {
  dark: boolean;
  colors: ThemeColors;
}

// Create light and dark themes based on colors
const lightTheme: ThemeType = {
  dark: false,
  colors: {
    ...colors,
    background: '#F5F7FA',
    surface: '#FFFFFF',
    text: '#2D3748',
    textSecondary: '#718096',
    border: '#E2E8F0',
  },
};

const darkTheme: ThemeType = {
  dark: true,
  colors: {
    ...colors,
    background: '#1A202C',
    surface: '#2D3748',
    text: '#F7FAFC',
    textSecondary: '#CBD5E0',
    border: '#4A5568',
  },
};

const ThemeContext = createContext<ThemeType>(lightTheme);

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const systemColorScheme = useColorScheme();
  const {darkMode} = useSettings();

  // Use the settings darkMode value if it exists, otherwise use system theme
  const [theme, setTheme] = useState<ThemeType>(
    darkMode !== undefined
      ? darkMode
        ? darkTheme
        : lightTheme
      : systemColorScheme === 'dark'
      ? darkTheme
      : lightTheme,
  );

  // Update theme when darkMode setting changes
  useEffect(() => {
    if (darkMode !== undefined) {
      setTheme(darkMode ? darkTheme : lightTheme);
    }
  }, [darkMode]);

  // Also listen for system theme changes if user hasn't explicitly set a preference
  useEffect(() => {
    if (darkMode === undefined) {
      setTheme(systemColorScheme === 'dark' ? darkTheme : lightTheme);
    }
  }, [systemColorScheme, darkMode]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
