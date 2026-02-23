import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
  Vibration,
  NativeModules,
  PermissionsAndroid,
  Platform,
  Alert,
  Image,
} from 'react-native';
import CallLogs from 'react-native-call-log';
import { requestCallLogPermission, requestPhoneStatePermission } from '../utils/permissions';
import { buildContactPhotoMap, lookupContact } from '../utils/contactLookup';

const { DialerModule } = NativeModules;

const CallLogsScreen = ({ onCall }) => {
  const [callLogs, setCallLogs] = useState([]);
  const [groupedCallLogs, setGroupedCallLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const contactMapRef = useRef(null);

  useEffect(() => {
    loadCallLogs();
  }, []);

  const groupCallLogs = (logs) => {
    // Group consecutive calls from the same number
    // Reset count when a different person appears
    const sorted = [...logs].sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
    const result = [];
    let current = null;

    sorted.forEach((log) => {
      const phoneNumber = log.phoneNumber || 'Unknown';
      if (current && current.phoneNumber === phoneNumber) {
        current.callCount += 1;
        current.allCalls.push(log);
        if (log.type === '1') current.hasIncoming = true;
        if (log.type === '2') current.hasOutgoing = true;
        if (log.type === '3') current.hasMissed = true;
      } else {
        if (current) result.push(current);
        current = {
          ...log,
          callCount: 1,
          allCalls: [log],
          hasIncoming: log.type === '1',
          hasOutgoing: log.type === '2',
          hasMissed: log.type === '3',
        };
      }
    });
    if (current) result.push(current);
    return result;
  };

  const loadCallLogs = async () => {
    setLoading(true);
    const hasCallLogPermission = await requestCallLogPermission();
    const hasPhoneStatePermission = await requestPhoneStatePermission();
    if (hasCallLogPermission && hasPhoneStatePermission) {
      setPermissionGranted(true);
      try {
        // Build contact photo lookup map
        contactMapRef.current = await buildContactPhotoMap();
        const logs = await CallLogs.load(100);
        setCallLogs(logs);
        setGroupedCallLogs(groupCallLogs(logs));
      } catch (error) {
        console.error('Error loading call logs:', error);
      }
    } else {
      setPermissionGranted(false);
    }
    setLoading(false);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(parseInt(timestamp));
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const timeString = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    if (diffDays === 0) return timeString;
    if (diffDays === 1) return `Yesterday`;
    if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getCallTypeInfo = (type) => {
    switch (type) {
      case '1':
        return { icon: '↙', color: '#22c55e', label: 'Incoming' };
      case '2':
        return { icon: '↗', color: 'rgba(255,255,255,0.4)', label: 'Outgoing' };
      case '3':
        return { icon: '↩', color: '#ef4444', label: 'Missed' };
      default:
        return { icon: '↙', color: 'rgba(255,255,255,0.3)', label: 'Unknown' };
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds === '0') return '';
    const duration = parseInt(seconds);
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleCallBack = async (phoneNumber, name) => {
    if (!phoneNumber) return;
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CALL_PHONE,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
      }
      Vibration.vibrate(100);
      if (DialerModule) {
        await DialerModule.startOutgoingCall(phoneNumber);
        const contact = lookupContact(contactMapRef.current, phoneNumber);
        if (onCall) {
          onCall({
            contactName: name || 'Unknown',
            phoneNumber,
            callState: 'outgoing',
            profilePicture: contact?.thumbnailPath || null,
          });
        }
      }
    } catch (error) {
      Alert.alert('Call Failed', error.message);
    }
  };

  const renderCallLogItem = ({ item }) => {
    const phoneNumber = item.phoneNumber || 'Unknown';
    const name = item.name || phoneNumber;
    const typeInfo = getCallTypeInfo(item.type);
    const duration = formatDuration(item.duration);
    const callCount = item.callCount || 1;
    const displayName = name !== phoneNumber ? name : phoneNumber;
    const showNumber = name !== phoneNumber;
    const contact = lookupContact(contactMapRef.current, phoneNumber);
    const hasPhoto = !!contact?.thumbnailPath;

    return (
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.04)',
        }}
        onPress={() => handleCallBack(phoneNumber, name)}
        activeOpacity={0.6}
      >
        {/* Avatar */}
        {hasPhoto ? (
          <Image
            source={{ uri: contact.thumbnailPath }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.06)',
              marginRight: 14,
            }}
          />
        ) : (
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.06)',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 14,
            }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '500' }}>
              {getInitials(name)}
            </Text>
          </View>
        )}

        {/* Info */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
            <Text
              style={{
                color: item.type === '3' ? '#ef4444' : '#fff',
                fontSize: 15,
                fontWeight: '400',
                flex: 1,
              }}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: '300' }}>
              {formatTimestamp(item.timestamp)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: typeInfo.color, fontSize: 14, fontWeight: '600', marginRight: 4 }}>
              {typeInfo.icon}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: '300' }}>
              {typeInfo.label}
            </Text>
            {callCount > 1 && (
              <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, fontWeight: '300', marginLeft: 2 }}>
                ({callCount})
              </Text>
            )}
            {duration ? (
              <>
                <Text style={{ color: 'rgba(255,255,255,0.15)', marginHorizontal: 6 }}>·</Text>
                <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: '300' }}>
                  {duration}
                </Text>
              </>
            ) : null}
            {showNumber && (
              <>
                <Text style={{ color: 'rgba(255,255,255,0.15)', marginHorizontal: 6 }}>·</Text>
                <Text
                  style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: '300', flex: 1 }}
                  numberOfLines={1}
                >
                  {phoneNumber}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Call back icon */}
        <TouchableOpacity
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            justifyContent: 'center',
            alignItems: 'center',
            marginLeft: 10,
          }}
          onPress={() => handleCallBack(phoneNumber, name)}
          activeOpacity={0.5}
        >
          <Text style={{ fontSize: 16 }}>📞</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderEmptyList = () => (
    <View style={{ alignItems: 'center', marginTop: 80 }}>
      <Text style={{ color: 'rgba(255,255,255,0.15)', fontSize: 48, marginBottom: 16 }}>📋</Text>
      <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 15, fontWeight: '300' }}>
        No call history
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a', paddingTop: StatusBar.currentHeight || 0 }}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.3)" />
        </View>
      </SafeAreaView>
    );
  }

  if (!permissionGranted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a', paddingTop: StatusBar.currentHeight || 0 }}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '300', textAlign: 'center', marginBottom: 24 }}>
            Call log access is needed to show your history
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
            }}
            onPress={loadCallLogs}
            activeOpacity={0.6}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '400' }}>
              Grant Access
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a', paddingTop: StatusBar.currentHeight || 0 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '300', letterSpacing: -0.5 }}>
            Recents
          </Text>
          {groupedCallLogs.length > 0 && (
            <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, fontWeight: '300', marginTop: 4 }}>
              {callLogs.length} call{callLogs.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 20 }} />

        {/* Call Logs List */}
        <FlatList
          data={groupedCallLogs}
          renderItem={renderCallLogItem}
          keyExtractor={(item, index) => `${item.phoneNumber}-${item.timestamp}-${index}`}
          ListEmptyComponent={renderEmptyList}
          contentContainerStyle={{ paddingBottom: 20, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </>
  );
};

export default CallLogsScreen;
