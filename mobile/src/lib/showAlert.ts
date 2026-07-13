import { Alert, Platform } from 'react-native';

/**
 * Cross-platform alert helper.
 *
 * - **Native (iOS/Android)**: delegates to `Alert.alert()` with full button support.
 * - **Web**: uses the browser `alert()` (which is synchronous and has no button
 *   callbacks), then auto-invokes the first button's `onPress` so navigation
 *   still works.
 */
export function showAlert(
  title: string,
  message: string,
  buttons?: { text: string; onPress?: () => void }[],
) {
  if (Platform.OS === 'web') {
    alert(`${title}: ${message}`);
    // On web, alert() is blocking — once dismissed, fire the primary action.
    buttons?.[0]?.onPress?.();
  } else {
    Alert.alert(title, message, buttons);
  }
}
