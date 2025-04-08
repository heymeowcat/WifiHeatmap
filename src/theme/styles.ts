import { StyleSheet } from 'react-native';
import { colors } from './colors';

export const globalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  button: {
    marginVertical: 8,
    borderRadius: 8,
  },
  activeButton: {
    backgroundColor: colors.accent,
  },
  stopButton: {
    backgroundColor: colors.error,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  input: {
    marginVertical: 8,
  },
});