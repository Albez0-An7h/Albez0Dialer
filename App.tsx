/**
 * Albez0Dialer - React Native Phone Dialer App
 * 
 * @format
 */

import "./global.css"
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, NativeModules, PermissionsAndroid, Platform, NativeEventEmitter, AppState } from 'react-native';
import { buildContactPhotoMap, lookupContact } from './utils/contactLookup';
import DialerScreen from './screens/DialerScreen';
import ContactsScreen from './screens/ContactsScreen';
import CallLogsScreen from './screens/CallLogsScreen';
import FavouritesScreen from './screens/FavouritesScreen';
import RotaryDialScreen from './screens/RotaryDialScreen';
import CallerScreen from './screens/CallerScreen';

const { DialerModule } = NativeModules;
const dialerEmitter = DialerModule ? new NativeEventEmitter(DialerModule) : null;

function App() {
  const [activeTab, setActiveTab] = useState('favourites');
  const [showRegularKeypad, setShowRegularKeypad] = useState(false);
  const [showCaller, setShowCaller] = useState(false);
  const [callerData, setCallerData] = useState(null);
  const contactMapRef = useRef(null);

  // Initialize dialer on app start
  useEffect(() => {
    const initializeDialer = async () => {
      try {
        // Request required permissions
        if (Platform.OS === 'android') {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.CALL_PHONE,
            PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
            PermissionsAndroid.PERMISSIONS.ANSWER_PHONE_CALLS,
            PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
          ]);
        }

        // Initialize phone account for Telecom framework
        if (DialerModule) {
          await DialerModule.initializePhoneAccount();
          console.log('App: Phone account initialized successfully');
        }

        // Build contact photo lookup map
        try {
          contactMapRef.current = await buildContactPhotoMap();
          console.log('App: Contact photo map built');
        } catch (e) {
          console.warn('App: Failed to build contact photo map:', e);
        }

        // Check if there's an active call (e.g., app opened from ongoing notification)
        try {
          const callState = await DialerModule.getCallState();
          if (callState.hasActiveCall) {
            console.log('App: Active call found on init, opening CallerScreen');
            const contact = lookupContact(contactMapRef.current, callState.phoneNumber);
            setCallerData({
              callId: callState.callId,
              contactName: contact?.name || callState.callerName || 'Unknown',
              phoneNumber: callState.phoneNumber || 'Unknown',
              callState: callState.state === 'holding' ? 'active' : (callState.state || 'active'),
              direction: callState.direction || 'outgoing',
              profilePicture: contact?.thumbnailPath || null,
            });
            setShowCaller(true);
          }
        } catch (e) {
          console.warn('App: Failed to check active call on init:', e);
        }
      } catch (error) {
        console.error('App: Failed to initialize dialer:', error);
      }
    };

    initializeDialer();
  }, []);

  // Re-open CallerScreen when app returns to foreground with an active call
  useEffect(() => {
    let prevState = AppState.currentState;

    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active' && prevState.match(/inactive|background/)) {
        try {
          if (!DialerModule?.getCallState) return;
          const state = await DialerModule.getCallState();
          if (state.hasActiveCall) {
            console.log('App: Active call found on resume, opening CallerScreen');
            const contact = lookupContact(contactMapRef.current, state.phoneNumber);
            setCallerData({
              callId: state.callId,
              contactName: contact?.name || state.callerName || 'Unknown',
              phoneNumber: state.phoneNumber || 'Unknown',
              callState: state.state === 'holding' ? 'active' : (state.state || 'active'),
              direction: state.direction || 'outgoing',
              profilePicture: contact?.thumbnailPath || null,
            });
            setShowCaller(true);
          }
        } catch (e) {
          console.warn('App: Failed to check active call on resume:', e);
        }
      }
      prevState = nextState;
    });

    return () => subscription.remove();
  }, []);

  // Listen for incoming calls and auto-open CallerScreen
  useEffect(() => {
    if (!dialerEmitter) {
      console.warn('App: DialerModule not available, incoming call detection disabled');
      return;
    }

    console.log('App: Setting up production incoming call listener with CallManager integration');
    
    const subscription = dialerEmitter.addListener('CALL_STATE_CHANGED', (event) => {
      console.log('═══════════════════════════════════════════');
      console.log('App: Received CALL_STATE_CHANGED event');
      console.log('Type:', event.type);
      console.log('Call ID:', event.callId);
      console.log('State:', event.state);
      console.log('Phone:', event.phoneNumber);
      console.log('Caller:', event.callerName);
      console.log('Direction:', event.direction);
      console.log('Disconnect:', event.disconnectCause);
      console.log('═══════════════════════════════════════════');
      
      // Handle incoming calls - auto-open CallerScreen
      if (event.type === 'CALL_ADDED' && event.direction === 'incoming') {
        console.log('🚨 INCOMING CALL DETECTED - Opening CallerScreen');
        const contact = lookupContact(contactMapRef.current, event.phoneNumber);
        const incomingCallData = {
          callId: event.callId,
          contactName: contact?.name || event.callerName || 'Unknown',
          phoneNumber: event.phoneNumber || 'Unknown',
          callState: 'incoming',
          direction: event.direction,
          profilePicture: contact?.thumbnailPath || null,
        };
        showCallerScreen(incomingCallData);
      }
      
      // Handle outgoing calls - already opened by button press
      if (event.type === 'CALL_ADDED' && event.direction === 'outgoing') {
        console.log('📞 Outgoing call confirmed by system');
        // CallerScreen already open from onCall callback
      }
      
      // Handle state changes - pass to CallerScreen via its own listener
      if (event.type === 'STATE_CHANGED') {
        console.log(`📊 Call state changed to: ${event.state}`);
        // CallerScreen handles this via its own event listener
      }
      
      // Auto-close CallerScreen when call is removed
      if (event.type === 'CALL_REMOVED') {
        console.log('🔚 Call removed - ensuring CallerScreen closes');
        // Give CallerScreen a moment to handle it first
        if (showCaller) {
          console.log('App: Force closing CallerScreen after CALL_REMOVED');
          setTimeout(() => {
            hideCallerScreen();
          }, 1000);
        }
      }
    });

    return () => {
      console.log('App: Removing incoming call listener');
      subscription.remove();
    };
  }, [showCaller]);

  const showCallerScreen = (data) => {
    setCallerData(data);
    setShowCaller(true);
  };

  const hideCallerScreen = () => {
    setShowCaller(false);
    setCallerData(null);
  };

  const renderScreen = () => {
    if (showCaller && callerData) {
      return <CallerScreen route={{ params: callerData }} navigation={{ goBack: hideCallerScreen }} />;
    }

    switch (activeTab) {
      case 'dialer':
        if (showRegularKeypad) {
          return <DialerScreen onRotaryPress={() => setShowRegularKeypad(false)} onCall={showCallerScreen} />;
        }
        return <RotaryDialScreen onBack={() => setShowRegularKeypad(true)} onCall={showCallerScreen} />;
      case 'favourites':
        return <FavouritesScreen onCall={showCallerScreen} />;
      case 'contacts':
        return <ContactsScreen onCall={showCallerScreen} />;
      case 'logs':
        return <CallLogsScreen onCall={showCallerScreen} />;
      default:
        return <DialerScreen onRotaryPress={() => setShowRotary(true)} onCall={showCallerScreen} />;
    }
  };

  // Hide tab bar when caller screen is showing
  if (showCaller) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
        {renderScreen()}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      {renderScreen()}
      
      {/* Bottom Tab Navigation */}
      <View style={{
        flexDirection: 'row',
        backgroundColor: '#0a0a0a',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
        paddingTop: 8,
        paddingBottom: 28,
      }}>
        {[
          { key: 'dialer', label: 'Keypad', icon: '⌨' },
          { key: 'favourites', label: 'Starred', icon: '★' },
          { key: 'contacts', label: 'Contacts', icon: '●' },
          { key: 'logs', label: 'Recents', icon: '↻' },
        ].map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.6}
            >
              <Text style={{
                fontSize: 18,
                color: active ? '#fff' : 'rgba(255,255,255,0.2)',
                marginBottom: 4,
              }}>
                {tab.icon}
              </Text>
              <Text style={{
                fontSize: 10,
                fontWeight: active ? '500' : '300',
                color: active ? '#fff' : 'rgba(255,255,255,0.25)',
                letterSpacing: 0.3,
              }}>
                {tab.label}
              </Text>
              {active && (
                <View style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#fff',
                  marginTop: 4,
                }} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default App;
