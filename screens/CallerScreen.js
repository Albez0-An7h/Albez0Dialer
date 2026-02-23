import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Animated,
  Dimensions,
  NativeModules,
  NativeEventEmitter,
  Image,
  Modal,
  Vibration,
} from 'react-native';

const { width, height } = Dimensions.get('window');
const { DialerModule } = NativeModules;
const dialerEmitter = new NativeEventEmitter(DialerModule);

const CallerScreen = ({ route, navigation }) => {
  const contactName = route?.params?.contactName || 'Unknown';
  const phoneNumber = route?.params?.phoneNumber || '';
  const initialState = route?.params?.callState || 'incoming';
  const profilePicture = route?.params?.profilePicture || null;

  const [callState, setCallState] = useState(initialState);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [showKeypad, setShowKeypad] = useState(false);
  const [dtmfInput, setDtmfInput] = useState('');
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [audioRoutes, setAudioRoutes] = useState([]);
  const [currentAudioRoute, setCurrentAudioRoute] = useState(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const keypadSlide = useRef(new Animated.Value(0)).current;

  // Poll native call state on mount
  useEffect(() => {
    const pollCallState = async () => {
      try {
        if (!DialerModule?.getCallState) return;
        const state = await DialerModule.getCallState();
        if (state.hasActiveCall && state.state) {
          if (state.state === 'holding') {
            setCallState('active');
            setIsOnHold(true);
          } else if (state.state !== callState) {
            setCallState(state.state);
            if (state.state === 'active') setCallDuration(0);
          }
        }
      } catch (e) {}
    };
    pollCallState();
  }, []);

  // Listen to native call events
  useEffect(() => {
    const subscription = dialerEmitter.addListener('CALL_STATE_CHANGED', (event) => {
      if (event.type === 'CALL_ADDED') {
        if (event.state === 'holding') {
          setCallState('active');
          setIsOnHold(true);
        } else {
          setCallState(event.state);
        }
      } else if (event.type === 'STATE_CHANGED') {
        if (event.state === 'holding') {
          // Call placed on hold by native side
          setCallState('active');
          setIsOnHold(true);
        } else {
          setCallState((prev) => {
            // Only reset timer when transitioning to active from non-active (not from hold resume)
            if (event.state === 'active' && prev !== 'active') {
              setCallDuration(0);
            }
            return event.state;
          });
          if (event.state === 'active') {
            setIsOnHold(false);
          }
          if (event.state === 'ended') {
            setTimeout(() => navigation?.goBack(), 1500);
          }
        }
      } else if (event.type === 'CALL_REMOVED') {
        setCallState('ended');
        setTimeout(() => navigation?.goBack(), 1500);
      }
    });
    return () => subscription.remove();
  }, [navigation]);

  // Outgoing call timeout
  useEffect(() => {
    if (callState === 'outgoing') {
      const timeout = setTimeout(() => {
        setCallState('ended');
        setTimeout(() => navigation?.goBack(), 1500);
      }, 60000);
      return () => clearTimeout(timeout);
    }
  }, [callState, navigation]);

  // Call duration timer
  useEffect(() => {
    let interval;
    if (callState === 'active') {
      interval = setInterval(() => setCallDuration((p) => p + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callState]);

  // Pulse animation
  useEffect(() => {
    if (callState === 'incoming' || callState === 'outgoing') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [callState]);

  // Ring ripple for incoming
  useEffect(() => {
    if (callState === 'incoming') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(ringAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    } else {
      ringAnim.setValue(0);
    }
  }, [callState]);

  // Fade in
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  // Keypad slide animation
  useEffect(() => {
    Animated.timing(keypadSlide, {
      toValue: showKeypad ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [showKeypad]);

  // ────────────────────── Helpers ──────────────────────
  const formatDuration = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const getInitials = (name) =>
    name ? name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) : '?';

  const getStatusText = () => {
    switch (callState) {
      case 'incoming': return 'Incoming Call';
      case 'outgoing': return 'Calling…';
      case 'active': return isOnHold ? 'On Hold' : '';
      case 'ended': return 'Call Ended';
      default: return '';
    }
  };

  // ────────────────────── Handlers ──────────────────────
  const handleAccept = async () => {
    Vibration.vibrate(30);
    try { await DialerModule.answerCall(); } catch (e) { setCallState('active'); }
  };

  const handleDecline = async () => {
    Vibration.vibrate(50);
    setCallState('ended');
    try { await DialerModule.rejectCall(); } catch (e) {}
    setTimeout(() => navigation?.goBack(), 1500);
  };

  const handleEndCall = async () => {
    Vibration.vibrate(50);
    setCallState('ended');
    try { await DialerModule.endCall(); } catch (e) {}
    setTimeout(() => navigation?.goBack(), 1500);
  };

  const handleMute = async () => {
    Vibration.vibrate(10);
    const next = !isMuted;
    setIsMuted(next);
    try { await DialerModule.toggleMute(next); } catch (e) {}
  };

  const handleSpeaker = async () => {
    Vibration.vibrate(10);
    const next = !isSpeaker;
    setIsSpeaker(next);
    try { await DialerModule.toggleSpeaker(next); } catch (e) {}
  };

  const handleSpeakerLongPress = async () => {
    Vibration.vibrate(20);
    try {
      const result = await DialerModule.getAvailableAudioRoutes();
      if (result?.routes) {
        // Convert ReadableArray to JS array
        const routeArr = [];
        for (let i = 0; i < result.routes.length; i++) {
          routeArr.push(result.routes[i]);
        }
        setAudioRoutes(routeArr);
        setCurrentAudioRoute(result.currentRoute);
      }
    } catch (e) {
      // Fallback routes
      setAudioRoutes([
        { name: 'Earpiece', route: 1, active: !isSpeaker },
        { name: 'Speaker', route: 8, active: isSpeaker },
      ]);
    }
    setShowAudioMenu(true);
  };

  const handleSetAudioRoute = async (route) => {
    try {
      await DialerModule.setAudioRoute(route);
      setCurrentAudioRoute(route);
      setIsSpeaker(route === 8); // 8 = ROUTE_SPEAKER
    } catch (e) {}
    setShowAudioMenu(false);
  };

  const handleHold = async () => {
    Vibration.vibrate(10);
    const next = !isOnHold;
    setIsOnHold(next);
    try { await DialerModule.toggleHold(next); } catch (e) {}
  };

  const handleKeypadToggle = () => {
    Vibration.vibrate(10);
    setShowKeypad(!showKeypad);
  };

  const handleDtmfPress = async (digit) => {
    Vibration.vibrate(10);
    setDtmfInput((p) => p + digit);
    try { await DialerModule.sendDtmf(digit); } catch (e) {}
  };

  // ────────────────────── Components ──────────────────────
  const ActionBtn = ({ icon, label, onPress, onLongPress, active = false }) => (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={{ alignItems: 'center', width: 76 }}
    >
      <View
        style={{
          width: 54, height: 54, borderRadius: 27,
          backgroundColor: active ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
          borderWidth: 1,
          borderColor: active ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.06)',
          justifyContent: 'center', alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 20, opacity: active ? 1 : 0.8 }}>{icon}</Text>
      </View>
      <Text style={{
        color: active ? '#22c55e' : 'rgba(255,255,255,0.4)',
        fontSize: 10, marginTop: 6, fontWeight: '500', letterSpacing: 0.3,
      }}>{label}</Text>
    </TouchableOpacity>
  );

  const EndCallBtn = ({ size = 58 }) => (
    <TouchableOpacity activeOpacity={0.7} onPress={handleEndCall} style={{ alignItems: 'center', width: 76 }}>
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: '#dc2626',
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ fontSize: 24, transform: [{ rotate: '135deg' }] }}>📞</Text>
      </View>
      <Text style={{ color: 'rgba(239,68,68,0.7)', fontSize: 10, marginTop: 6, fontWeight: '500' }}>End</Text>
    </TouchableOpacity>
  );

  // ────────────────────── DTMF Keypad ──────────────────────
  const DtmfKeypad = () => {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['*', '0', '#'],
    ];

    const slideY = keypadSlide.interpolate({
      inputRange: [0, 1],
      outputRange: [300, 0],
    });

    return (
      <Animated.View style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        backgroundColor: '#0a0a0a',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
        paddingTop: 16,
        paddingBottom: 48,
        paddingHorizontal: 30,
        transform: [{ translateY: slideY }],
      }}>
        {/* DTMF input display */}
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <Text style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: 20,
            fontWeight: '300',
            letterSpacing: 3,
            minHeight: 28,
          }}>
            {dtmfInput}
          </Text>
        </View>

        {/* Keypad grid */}
        {keys.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', justifyContent: 'space-evenly', marginBottom: 10 }}>
            {row.map((digit) => (
              <TouchableOpacity
                key={digit}
                activeOpacity={0.6}
                onPress={() => handleDtmfPress(digit)}
                style={{
                  width: 68, height: 48, borderRadius: 24,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  justifyContent: 'center', alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '400' }}>{digit}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Close & End row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', marginTop: 8, alignItems: 'center' }}>
          <View style={{ width: 76 }} />
          <EndCallBtn size={54} />
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={handleKeypadToggle}
            style={{ alignItems: 'center', width: 76 }}
          >
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18 }}>✕</Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 2, fontWeight: '500' }}>Hide</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  // ────────────────────── Audio Route Modal ──────────────────────
  const AudioRouteModal = () => (
    <Modal
      visible={showAudioMenu}
      transparent
      animationType="fade"
      onRequestClose={() => setShowAudioMenu(false)}
    >
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}
        activeOpacity={1}
        onPress={() => setShowAudioMenu(false)}
      >
        <View style={{
          backgroundColor: '#161616',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingTop: 20,
          paddingBottom: 40,
          paddingHorizontal: 24,
        }}>
          <Text style={{
            color: '#fff', fontSize: 16, fontWeight: '500',
            marginBottom: 20, textAlign: 'center',
          }}>
            Audio Output
          </Text>

          {audioRoutes.map((r, i) => {
            const isActive = r.route === currentAudioRoute;
            const iconMap = {
              Earpiece: '📱',
              Speaker: '🔊',
              Bluetooth: '🎧',
              'Wired Headset': '🎧',
            };
            return (
              <TouchableOpacity
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  backgroundColor: isActive ? 'rgba(34,197,94,0.1)' : 'transparent',
                  borderRadius: 12,
                  marginBottom: 4,
                  borderWidth: isActive ? 1 : 0,
                  borderColor: 'rgba(34,197,94,0.3)',
                }}
                activeOpacity={0.6}
                onPress={() => handleSetAudioRoute(r.route)}
              >
                <Text style={{ fontSize: 20, marginRight: 14 }}>{iconMap[r.name] || '🔈'}</Text>
                <Text style={{ color: isActive ? '#22c55e' : '#fff', fontSize: 15, fontWeight: '400', flex: 1 }}>
                  {r.name}
                </Text>
                {isActive && (
                  <Text style={{ color: '#22c55e', fontSize: 14 }}>✓</Text>
                )}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={{ alignItems: 'center', marginTop: 12 }}
            onPress={() => setShowAudioMenu(false)}
            activeOpacity={0.6}
          >
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '500' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const handleAddCall = async () => {
    Vibration.vibrate(10);
    // Put current call on hold first
    if (!isOnHold) {
      setIsOnHold(true);
      try { await DialerModule.toggleHold(true); } catch (e) {}
    }
    // Navigate back to dialer so user can dial a new number
    navigation?.goBack();
  };

  // ────────────────────── Render ──────────────────────
  const avatarSize = callState === 'active' ? 80 : 100;
  const showBgImage = profilePicture && (callState === 'active' || callState === 'incoming' || callState === 'outgoing');
  const hideAvatar = profilePicture && callState === 'active';
  const ringScale = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const ringOpacity = ringAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.3, 0.1, 0] });

  const renderAvatar = () => {
    if (profilePicture) {
      return (
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          {callState === 'incoming' && (
            <Animated.View style={{
              position: 'absolute',
              width: avatarSize + 40, height: avatarSize + 40,
              borderRadius: (avatarSize + 40) / 2,
              borderWidth: 1.5, borderColor: '#22c55e',
              transform: [{ scale: ringScale }], opacity: ringOpacity,
              top: -20, left: -20,
            }} />
          )}
          <Image
            source={{ uri: profilePicture }}
            style={{
              width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2,
              borderWidth: 2,
              borderColor: callState === 'incoming' ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)',
            }}
          />
        </Animated.View>
      );
    }

    return (
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        {callState === 'incoming' && (
          <Animated.View style={{
            position: 'absolute',
            width: avatarSize + 40, height: avatarSize + 40,
            borderRadius: (avatarSize + 40) / 2,
            borderWidth: 1.5, borderColor: '#22c55e',
            transform: [{ scale: ringScale }], opacity: ringOpacity,
            top: -20, left: -20,
          }} />
        )}
        <View style={{
          width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2,
          backgroundColor: '#141425',
          justifyContent: 'center', alignItems: 'center',
          borderWidth: 1,
          borderColor: callState === 'incoming' ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.05)',
        }}>
          <Text style={{ fontSize: avatarSize * 0.35, color: 'rgba(255,255,255,0.65)', fontWeight: '600' }}>
            {getInitials(contactName)}
          </Text>
        </View>
      </Animated.View>
    );
  };

  const renderControls = () => {
    // ── Incoming: Accept / Decline ──
    if (callState === 'incoming') {
      return (
        <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }}>
          <TouchableOpacity activeOpacity={0.7} onPress={handleDecline} style={{ alignItems: 'center' }}>
            <View style={{
              width: 66, height: 66, borderRadius: 33,
              backgroundColor: 'rgba(239,68,68,0.12)',
              borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.35)',
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ fontSize: 26, transform: [{ rotate: '135deg' }] }}>📞</Text>
            </View>
            <Text style={{ color: 'rgba(239,68,68,0.7)', fontSize: 11, marginTop: 10, fontWeight: '500' }}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.7} onPress={handleAccept} style={{ alignItems: 'center' }}>
            <View style={{
              width: 66, height: 66, borderRadius: 33,
              backgroundColor: 'rgba(34,197,94,0.12)',
              borderWidth: 1.5, borderColor: 'rgba(34,197,94,0.45)',
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ fontSize: 26 }}>📞</Text>
            </View>
            <Text style={{ color: '#22c55e', fontSize: 11, marginTop: 10, fontWeight: '500' }}>Accept</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // ── Outgoing: End Call ──
    if (callState === 'outgoing') {
      return (
        <View style={{ alignItems: 'center' }}>
          <EndCallBtn size={66} />
        </View>
      );
    }

    // ── Active (on hold): Hold-specific controls ──
    if (callState === 'active' && isOnHold && !showKeypad) {
      return (
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }}>
            <ActionBtn
              icon="▶️"
              label="Resume"
              onPress={handleHold}
              active={true}
            />
            <EndCallBtn />
            <ActionBtn icon="➕" label="Add" onPress={handleAddCall} />
          </View>
        </View>
      );
    }

    // ── Active: Full Controls ──
    if (callState === 'active' && !showKeypad) {
      return (
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', marginBottom: 24 }}>
            <ActionBtn
              icon={isMuted ? '🔇' : '🎤'}
              label={isMuted ? 'Unmute' : 'Mute'}
              onPress={handleMute}
              active={isMuted}
            />
            <ActionBtn icon="⌨️" label="Keypad" onPress={handleKeypadToggle} />
            <ActionBtn
              icon={isSpeaker ? '🔊' : '🔈'}
              label="Speaker"
              onPress={handleSpeaker}
              onLongPress={handleSpeakerLongPress}
              active={isSpeaker}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }}>
            <ActionBtn
              icon="⏸️"
              label="Hold"
              onPress={handleHold}
            />
            <EndCallBtn />
            <ActionBtn icon="➕" label="Add" onPress={handleAddCall} />
          </View>
        </View>
      );
    }

    // ── Ended ──
    if (callState === 'ended') {
      return (
        <View style={{ alignItems: 'center', opacity: 0.5 }}>
          <View style={{
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: 'rgba(255,255,255,0.04)',
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ fontSize: 24 }}>📵</Text>
          </View>
        </View>
      );
    }

    return null;
  };

  // ────────────────────── Main Layout ──────────────────────
  const content = (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      {/* Background image overlay */}
      {showBgImage && (
        <Image
          source={{ uri: profilePicture }}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            width: '100%', height: '100%',
          }}
          blurRadius={callState === 'active' ? 0 : 20}
          resizeMode="cover"
        />
      )}
      {showBgImage && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: callState === 'active' ? 'rgba(10,10,10,0.45)' : 'rgba(10,10,10,0.7)',
        }} />
      )}

      {/* === TOP: Contact Info === */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 10 }}>
        {!hideAvatar && renderAvatar()}

        {/* Name */}
        <Text
          style={{
            fontSize: 26, fontWeight: '600', color: '#fff',
            letterSpacing: 0.2, marginTop: 20, marginBottom: 4,
          }}
          numberOfLines={1}
        >
          {contactName}
        </Text>

        {/* Phone Number */}
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5, marginBottom: 16 }}>
          {phoneNumber}
        </Text>

        {/* Status / Timer */}
        {callState === 'active' && !isOnHold ? (
          <Text style={{
            fontSize: 40, fontWeight: '200', color: '#fff',
            letterSpacing: 4, fontVariant: ['tabular-nums'],
          }}>
            {formatDuration(callDuration)}
          </Text>
        ) : (
          <Text style={{
            fontSize: 14,
            color: callState === 'ended' ? 'rgba(239,68,68,0.7)'
              : callState === 'active' ? '#22c55e'
              : 'rgba(255,255,255,0.3)',
            fontWeight: '500', letterSpacing: 0.5,
          }}>
            {getStatusText()}
          </Text>
        )}
      </View>

      {/* === BOTTOM: Controls === */}
      <View style={{ paddingBottom: showKeypad ? 0 : 48, paddingHorizontal: 24 }}>
        {renderControls()}
      </View>

      {/* DTMF Keypad Overlay */}
      {showKeypad && callState === 'active' && <DtmfKeypad />}
    </Animated.View>
  );

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', paddingTop: StatusBar.currentHeight || 0 }}>
        {content}
      </View>
      <AudioRouteModal />
    </>
  );
};

export default CallerScreen;
