import React, { createContext, useContext, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { colors } from './colors';

// Define theme types
export type ThemeType = {
  colors: typeof colors;
  dark: boolean;
};

// Create light and dark themes
const lightTheme: ThemeType = {
  colors,
  dark: false,
};

const darkTheme: ThemeType = {
  colors: {
    ...colors,
    background: '#1A202C',
    surface: '#2D3748',
    text: '#F7FAFC',
    textSecondary: '#A0AEC0',
    border: '#4A5568',
  },
  dark: true,
};

// Create context
const ThemeContext = createContext<ThemeType>(lightTheme);

// Theme provider component
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook to use theme
export const useTheme = () => useContext(ThemeContext);