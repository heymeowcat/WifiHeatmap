import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { PaperThemeProvider } from './src/theme/PaperThemeProvider';
import AppNavigator from './src/navigation/AppNavigator';

const App = () => {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PaperThemeProvider>
          <AppNavigator />
        </PaperThemeProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

export default App;
