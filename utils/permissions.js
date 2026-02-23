import { PermissionsAndroid, Platform, Alert } from 'react-native';

/**
 * Request READ_CONTACTS permission
 */
export const requestContactsPermission = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
      {
        title: 'Contacts Permission',
        message: 'This app needs access to your contacts to display them.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );

    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      return true;
    } else {
      Alert.alert(
        'Permission Denied',
        'Cannot access contacts without permission.'
      );
      return false;
    }
  } catch (err) {
    console.warn(err);
    return false;
  }
};

/**
 * Request READ_CALL_LOG permission
 */
export const requestCallLogPermission = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
      {
        title: 'Call Log Permission',
        message: 'This app needs access to your call logs to display them.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );

    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      return true;
    } else {
      Alert.alert(
        'Permission Denied',
        'Cannot access call logs without permission.'
      );
      return false;
    }
  } catch (err) {
    console.warn(err);
    return false;
  }
};

/**
 * Request READ_PHONE_STATE permission
 */
export const requestPhoneStatePermission = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
      {
        title: 'Phone State Permission',
        message: 'This app needs access to your phone state.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );

    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn(err);
    return false;
  }
};

/**
 * Check if contacts permission is granted
 */
export const checkContactsPermission = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS
    );
    return granted;
  } catch (err) {
    console.warn(err);
    return false;
  }
};

/**
 * Check if call log permission is granted
 */
export const checkCallLogPermission = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG
    );
    return granted;
  } catch (err) {
    console.warn(err);
    return false;
  }
};
