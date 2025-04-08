import React from 'react';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { useTheme, ThemeType } from './ThemeProvider';

// Convert our theme to Paper theme
const createPaperTheme = (theme: ThemeType) => {
  const paperTheme = theme.dark ? { ...MD3DarkTheme } : { ...MD3LightTheme };
  
  return {
    ...paperTheme,
    colors: {
      ...paperTheme.colors,
      primary: theme.colors.primary,
      secondary: theme.colors.secondary,
      accent: theme.colors.accent,
      background: theme.colors.background,
      surface: theme.colors.surface,
      error: theme.colors.error,
      text: theme.colors.text,
      onSurface: theme.colors.text,
      disabled: theme.colors.disabled,
      placeholder: theme.colors.textSecondary,
      backdrop: theme.colors.background,
      notification: theme.colors.accent,
    },
  };
};

export const PaperThemeProvider = ({ children }) => {
  const theme = useTheme();
  const paperTheme = createPaperTheme(theme);

  return <PaperProvider theme={paperTheme}>{children}</PaperProvider>;
};