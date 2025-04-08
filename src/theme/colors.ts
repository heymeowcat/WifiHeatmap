// Professional color palette for WiFi Heatmap app
export const colors = {
  primary: '#2E5BFF',      // Primary blue
  secondary: '#33A1FD',    // Secondary blue
  accent: '#00C781',       // Green accent
  background: '#F5F7FA',   // Light background
  surface: '#FFFFFF',      // White surface
  error: '#FF4949',        // Error red
  text: '#2D3748',         // Dark text
  textSecondary: '#718096', // Secondary text
  border: '#E2E8F0',       // Border color
  disabled: '#CBD5E0',     // Disabled state
  success: '#00C781',      // Success green
  warning: '#FFAA15',      // Warning yellow
};

// Signal strength color mapping
export const getSignalStrengthColor = (strength: number) => {
  const normalizedStrength = (strength + 100) / 70;
  // Using a blue-green gradient instead of the previous hue rotation
  if (normalizedStrength > 0.7) return '#00C781'; // Strong - Green
  if (normalizedStrength > 0.4) return '#33A1FD'; // Medium - Blue
  return '#FF4949'; // Weak - Red
};