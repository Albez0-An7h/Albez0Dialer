import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Vibration,
  StatusBar,
  Dimensions,
  PermissionsAndroid,
  Platform,
  NativeModules,
} from 'react-native';
import KeypadButton from '../components/KeypadButton';

const { width } = Dimensions.get('window');
const { DialerModule } = NativeModules;

const DialerScreen = ({ onRotaryPress, onCall }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isDefaultDialer, setIsDefaultDialer] = useState(false);

  useEffect(() => {
    const checkDefaultStatus = async () => {
      if (DialerModule) {
        try {
          const isDefault = await DialerModule.isDefaultDialer();
          setIsDefaultDialer(isDefault);
        } catch (e) {}
      }
    };
    checkDefaultStatus();
  }, []);

  const requestDefaultDialer = async () => {
    if (DialerModule) {
      try {
        await DialerModule.requestDialerRole();
        setTimeout(async () => {
          const isDefault = await DialerModule.isDefaultDialer();
          setIsDefaultDialer(isDefault);
        }, 1000);
      } catch (error) {
        Alert.alert('Error', `Failed to request default dialer: ${error.message}`);
      }
    }
  };

  const keypadNumbers = [
    [{ label: '1', subText: '' }, { label: '2', subText: 'ABC' }, { label: '3', subText: 'DEF' }],
    [{ label: '4', subText: 'GHI' }, { label: '5', subText: 'JKL' }, { label: '6', subText: 'MNO' }],
    [{ label: '7', subText: 'PQRS' }, { label: '8', subText: 'TUV' }, { label: '9', subText: 'WXYZ' }],
    [{ label: '*', subText: '' }, { label: '0', subText: '+' }, { label: '#', subText: '' }],
  ];

  const handleNumberPress = (number) => setPhoneNumber((p) => p + number);
  const handleDelete = () => { Vibration.vibrate(20); setPhoneNumber((p) => p.slice(0, -1)); };
  const handleLongPressDelete = () => { Vibration.vibrate(60); setPhoneNumber(''); };

  const handleCall = async () => {
    if (!phoneNumber) return;
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CALL_PHONE);
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
      }
      Vibration.vibrate(100);
      if (DialerModule) {
        await DialerModule.startOutgoingCall(phoneNumber);
        if (onCall) {
          onCall({ contactName: 'Unknown', phoneNumber, callState: 'outgoing' });
        }
      }
    } catch (error) {
      Alert.alert('Call Failed', error.message);
    }
  };

  const testIncomingCall = async () => {
    try {
      if (DialerModule) await DialerModule.testIncomingCall('+1234567890', 'Test Caller');
    } catch (e) {}
  };

  const formatPhoneNumber = (number) => {
    if (!number) return '';
    if (number.includes('*') || number.includes('#')) return number;
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    if (cleaned.length <= 10) return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    return `+${cleaned.slice(0, cleaned.length - 10)} ${cleaned.slice(-10, -7)} ${cleaned.slice(-7, -4)} ${cleaned.slice(-4)}`;
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a', paddingTop: StatusBar.currentHeight || 0 }}>
        <View style={{ flex: 1 }}>

          {/* Default dialer banner */}
          {!isDefaultDialer && (
            <TouchableOpacity
              onPress={requestDefaultDialer}
              activeOpacity={0.7}
              style={{
                marginHorizontal: 20,
                marginTop: 12,
                backgroundColor: 'rgba(239,68,68,0.1)',
                borderWidth: 1,
                borderColor: 'rgba(239,68,68,0.25)',
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'rgba(239,68,68,0.8)', fontSize: 12, fontWeight: '500' }}>
                Tap to set as Default Dialer
              </Text>
            </TouchableOpacity>
          )}

          {/* Phone Number Display */}
          <View style={{ flex: 0.35, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 30, paddingBottom: 20 }}>
            {/* Rotary dial toggle */}
            {onRotaryPress && (
              <TouchableOpacity
                onPress={onRotaryPress}
                activeOpacity={0.6}
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 20,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 16,
                }}
              >
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '500' }}>
                  Rotary
                </Text>
              </TouchableOpacity>
            )}

            <Text
              style={{
                fontSize: phoneNumber ? 32 : 20,
                color: phoneNumber ? '#fff' : 'rgba(255,255,255,0.2)',
                fontWeight: '300',
                letterSpacing: phoneNumber ? 1.5 : 0,
                textAlign: 'center',
              }}
              numberOfLines={2}
            >
              {phoneNumber ? formatPhoneNumber(phoneNumber) : 'Enter number'}
            </Text>
          </View>

          {/* Keypad Grid */}
          <View style={{ flex: 0.65, justifyContent: 'center', paddingHorizontal: 30 }}>
            {keypadNumbers.map((row, rowIndex) => (
              <View
                key={rowIndex}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-evenly',
                  marginBottom: 14,
                }}
              >
                {row.map((item) => (
                  <KeypadButton
                    key={item.label}
                    label={item.label}
                    subText={item.subText}
                    onPress={() => handleNumberPress(item.label)}
                  />
                ))}
              </View>
            ))}

            {/* Bottom row: Test / Call / Delete */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-evenly',
                alignItems: 'center',
                marginTop: 10,
              }}
            >
              {/* Test incoming */}
              <TouchableOpacity
                style={{
                  width: 48, height: 48, borderRadius: 24,
                  backgroundColor: 'rgba(245,158,11,0.1)',
                  borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)',
                  justifyContent: 'center', alignItems: 'center',
                }}
                onPress={testIncomingCall}
                activeOpacity={0.6}
              >
                <Text style={{ fontSize: 20 }}>📲</Text>
              </TouchableOpacity>

              {/* Call Button */}
              <TouchableOpacity
                style={{
                  width: 64, height: 64, borderRadius: 32,
                  backgroundColor: '#22c55e',
                  justifyContent: 'center', alignItems: 'center',
                }}
                onPress={handleCall}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 28 }}>📞</Text>
              </TouchableOpacity>

              {/* Delete */}
              <TouchableOpacity
                style={{
                  width: 48, height: 48, borderRadius: 24,
                  justifyContent: 'center', alignItems: 'center',
                }}
                onPress={handleDelete}
                onLongPress={handleLongPressDelete}
                activeOpacity={0.5}
              >
                <Text style={{ fontSize: 22, color: 'rgba(255,255,255,0.4)' }}>⌫</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
};

export default DialerScreen;
