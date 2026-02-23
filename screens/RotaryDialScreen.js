import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Alert,
    PermissionsAndroid,
    Platform,
    NativeModules,
    Vibration,
} from 'react-native';
import RotaryDial from '../components/RotaryDial';

const { DialerModule } = NativeModules;

const RotaryDialScreen = ({ onBack, onCall }) => {
    const [phoneNumber, setPhoneNumber] = useState('');

    /**
     * Handle number dialed from rotary dial
     */
    const handleNumberDialed = (number) => {
        console.log('RotaryDialScreen received number:', number);
        setPhoneNumber(prev => {
            const newNumber = prev + number.toString();
            console.log('Updated phone number:', newNumber);
            return newNumber;
        });
    };

    /**
     * Delete last digit from phone number
     */
    const handleDelete = () => {
        if (phoneNumber.length === 0) return;

        Vibration.vibrate(20);

        setPhoneNumber(prev => prev.slice(0, -1));
    };

    /**
     * Initiate phone call using Telecom framework
     */
    const handleCall = async () => {
        if (!phoneNumber) {
            Alert.alert('⚠️ No Number', 'Please dial a number first', [
                { text: 'OK', style: 'default' }
            ]);
            return;
        }

        try {
            // Request CALL_PHONE permission on Android
            if (Platform.OS === 'android') {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.CALL_PHONE,
                    {
                        title: 'Phone Call Permission',
                        message: 'This app needs access to make phone calls',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    }
                );

                if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                    Alert.alert('Permission Denied', 'Cannot make calls without permission', [
                        { text: 'OK', style: 'default' }
                    ]);
                    return;
                }
            }

            Vibration.vibrate(100);

            // Use native DialerModule to place call through Telecom framework
            if (DialerModule) {
                try {
                    await DialerModule.startOutgoingCall(phoneNumber);
                    console.log('Call initiated via Telecom framework');
                    
                    // Show CallerScreen
                    if (onCall) {
                        onCall({
                            contactName: 'Unknown',
                            phoneNumber: phoneNumber,
                            callState: 'outgoing',
                        });
                    }
                } catch (error) {
                    console.error('Telecom call failed, error:', error);
                    Alert.alert('❌ Call Failed', `Could not place call: ${error.message}`, [
                        { text: 'OK', style: 'default' }
                    ]);
                }
            } else {
                Alert.alert('❌ Error', 'Dialer module not available', [
                    { text: 'OK', style: 'default' }
                ]);
            }
        } catch (error) {
            Alert.alert('❌ Error', `Failed to make call: ${error.message}`, [
                { text: 'OK', style: 'default' }
            ]);
        }
    };

    /**
     * Format phone number for display
     * Shows formatted version or placeholder
     */
    const formatDisplayNumber = (number) => {
        if (!number) return 'Dial a number';

        // Format as (XXX) XXX-XXXX for 10 digits
        if (number.length === 10) {
            return `(${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
        }

        return number;
    };

    return (
        <>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a', paddingTop: StatusBar.currentHeight || 0 }}>
                <View style={{ flex: 1 }}>
                    {/* Header with back button */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 20,
                        paddingVertical: 14,
                    }}>
                        {/* Placeholder for symmetry */}
                        <View style={{ width: 70 }} />

                        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '500', letterSpacing: 0.3 }}>Rotary Dialer</Text>

                        <TouchableOpacity
                            onPress={onBack}
                            activeOpacity={0.7}
                            style={{
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 16,
                                backgroundColor: 'rgba(255,255,255,0.06)',
                            }}
                        >
                            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '500' }}>Keypad</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Rotary Dial */}
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <RotaryDial onNumberDialed={handleNumberDialed} />
                    </View>

                    {/* Phone number display */}
                    <View style={{ paddingHorizontal: 24, paddingVertical: 12 }}>
                        <View style={{
                            backgroundColor: 'rgba(255,255,255,0.04)',
                            borderRadius: 16,
                            paddingHorizontal: 24,
                            paddingVertical: 20,
                            borderWidth: 1,
                            borderColor: phoneNumber ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)',
                            minHeight: 70,
                            justifyContent: 'center',
                        }}>
                            <Text
                                style={{
                                    textAlign: 'center',
                                    fontWeight: '300',
                                    letterSpacing: phoneNumber ? 2 : 0,
                                    color: phoneNumber ? '#fff' : 'rgba(255,255,255,0.2)',
                                    fontSize: phoneNumber ? 32 : 18,
                                }}
                                numberOfLines={2}
                                adjustsFontSizeToFit
                            >
                                {phoneNumber ? formatDisplayNumber(phoneNumber) : 'Drag to dial'}
                            </Text>
                        </View>
                    </View>

                    {/* Bottom buttons: Delete and Call */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingBottom: 32,
                        paddingTop: 8,
                        paddingHorizontal: 24,
                        gap: 40,
                    }}>
                        {/* Delete button */}
                        {phoneNumber.length > 0 && (
                            <TouchableOpacity
                                onPress={handleDelete}
                                activeOpacity={0.7}
                                style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 28,
                                    backgroundColor: 'rgba(239,68,68,0.12)',
                                    borderWidth: 1,
                                    borderColor: 'rgba(239,68,68,0.25)',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}
                            >
                                <Text style={{ fontSize: 22, color: 'rgba(239,68,68,0.8)' }}>⌫</Text>
                            </TouchableOpacity>
                        )}

                        {/* Call button */}
                        <TouchableOpacity
                            onPress={handleCall}
                            activeOpacity={0.7}
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: 32,
                                backgroundColor: '#22c55e',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                        >
                            <Text style={{ fontSize: 28 }}>📞</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </>
    );
};

export default RotaryDialScreen;
