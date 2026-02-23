import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Vibration,
  Alert,
  Image,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Contacts from 'react-native-contacts';
import { requestContactsPermission } from '../utils/permissions';
import { addFavourite, removeFavourite } from '../utils/storage';

const { DialerModule } = NativeModules;

const ContactsScreen = ({ onCall }) => {
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [favouriteIds, setFavouriteIds] = useState(new Set());

  useEffect(() => {
    loadContacts();
    loadFavouriteIds();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [searchQuery, contacts]);

  const loadFavouriteIds = async () => {
    try {
      const { getFavourites } = require('../utils/storage');
      const favs = await getFavourites();
      setFavouriteIds(new Set(favs.map((f) => f.recordID)));
    } catch (e) {}
  };

  const loadContacts = async () => {
    setLoading(true);
    const hasPermission = await requestContactsPermission();
    if (hasPermission) {
      setPermissionGranted(true);
      try {
        const contactsList = await Contacts.getAll();
        const sorted = contactsList.sort((a, b) =>
          (a.displayName || '').toLowerCase().localeCompare((b.displayName || '').toLowerCase()),
        );
        setContacts(sorted);
        setFilteredContacts(sorted);
      } catch (e) {
        console.error('Error loading contacts:', e);
      }
    } else {
      setPermissionGranted(false);
    }
    setLoading(false);
  };

  const filterContacts = () => {
    if (!searchQuery.trim()) {
      setFilteredContacts(contacts);
      return;
    }
    const q = searchQuery.toLowerCase();
    setFilteredContacts(
      contacts.filter((c) => {
        const dn = (c.displayName || '').toLowerCase();
        const gn = (c.givenName || '').toLowerCase();
        const fn = (c.familyName || '').toLowerCase();
        return dn.includes(q) || gn.includes(q) || fn.includes(q);
      }),
    );
  };

  const handleCallContact = async (contact, phoneNumber) => {
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
        if (onCall) {
          onCall({
            contactName: contact.displayName || 'Unknown',
            phoneNumber,
            callState: 'outgoing',
            profilePicture:
              contact.hasThumbnail && contact.thumbnailPath ? contact.thumbnailPath : null,
          });
        }
      }
    } catch (error) {
      Alert.alert('Call Failed', error.message);
    }
  };

  const handleToggleFavourite = async (contact) => {
    const isFav = favouriteIds.has(contact.recordID);
    try {
      Vibration.vibrate(50);
      if (isFav) {
        await removeFavourite(contact.recordID);
        setFavouriteIds((prev) => {
          const s = new Set(prev);
          s.delete(contact.recordID);
          return s;
        });
      } else {
        await addFavourite(contact);
        setFavouriteIds((prev) => new Set([...prev, contact.recordID]));
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to update favourites');
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  };

  // Section header letter
  const getSectionData = () => {
    const sections = [];
    let currentLetter = '';
    filteredContacts.forEach((contact, index) => {
      const firstChar = (contact.displayName || '?')[0].toUpperCase();
      if (firstChar !== currentLetter) {
        currentLetter = firstChar;
        sections.push({ type: 'header', letter: currentLetter, key: `header-${currentLetter}` });
      }
      sections.push({ type: 'contact', data: contact, key: contact.recordID });
    });
    return sections;
  };

  const renderItem = ({ item: section }) => {
    if (section.type === 'header') {
      return (
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 }}>
          <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13, fontWeight: '600', letterSpacing: 1 }}>
            {section.letter}
          </Text>
        </View>
      );
    }

    const item = section.data;
    const phoneNumber =
      item.phoneNumbers && item.phoneNumbers.length > 0 ? item.phoneNumbers[0].number : null;
    const isFav = favouriteIds.has(item.recordID);
    const hasProfilePic = item.hasThumbnail && item.thumbnailPath;

    return (
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 12,
        }}
        onPress={() => phoneNumber && handleCallContact(item, phoneNumber)}
        activeOpacity={phoneNumber ? 0.6 : 1}
      >
        {/* Avatar */}
        {hasProfilePic ? (
          <Image
            source={{ uri: item.thumbnailPath }}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: 'rgba(255,255,255,0.06)',
              marginRight: 14,
            }}
          />
        ) : (
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: 'rgba(255,255,255,0.06)',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 14,
            }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, fontWeight: '500' }}>
              {getInitials(item.displayName)}
            </Text>
          </View>
        )}

        {/* Name & number */}
        <View style={{ flex: 1 }}>
          <Text
            style={{ color: '#fff', fontSize: 15, fontWeight: '400', marginBottom: 2 }}
            numberOfLines={1}
          >
            {item.displayName || 'Unknown'}
          </Text>
          <Text
            style={{
              color: phoneNumber ? 'rgba(255,255,255,0.3)' : 'rgba(239,68,68,0.5)',
              fontSize: 13,
              fontWeight: '300',
            }}
            numberOfLines={1}
          >
            {phoneNumber || 'No number'}
          </Text>
        </View>

        {/* Favourite toggle */}
        <TouchableOpacity
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => handleToggleFavourite(item)}
          activeOpacity={0.5}
        >
          <Text style={{ fontSize: 16, opacity: isFav ? 1 : 0.2 }}>{isFav ? '★' : '☆'}</Text>
        </TouchableOpacity>

        {/* Call */}
        {phoneNumber && (
          <TouchableOpacity
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              justifyContent: 'center',
              alignItems: 'center',
              marginLeft: 4,
            }}
            onPress={() => handleCallContact(item, phoneNumber)}
            activeOpacity={0.5}
          >
            <Text style={{ fontSize: 15 }}>📞</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyList = () => (
    <View style={{ alignItems: 'center', marginTop: 80 }}>
      <Text style={{ color: 'rgba(255,255,255,0.15)', fontSize: 48, marginBottom: 16 }}>👥</Text>
      <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 15, fontWeight: '300' }}>
        {searchQuery ? 'No matches found' : 'No contacts'}
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
          <Text
            style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: 15,
              fontWeight: '300',
              textAlign: 'center',
              marginBottom: 24,
            }}
          >
            Contact access is needed to show your contacts
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
            onPress={loadContacts}
            activeOpacity={0.6}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '400' }}>Grant Access</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sectionData = searchQuery ? null : getSectionData();

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a', paddingTop: StatusBar.currentHeight || 0 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '300', letterSpacing: -0.5 }}>
            Contacts
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, fontWeight: '300', marginTop: 4 }}>
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <TextInput
            style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              color: '#fff',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 12,
              fontSize: 14,
              fontWeight: '300',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.06)',
            }}
            placeholder="Search"
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 20 }} />

        {/* Contacts List */}
        <FlatList
          data={searchQuery ? filteredContacts.map((c) => ({ type: 'contact', data: c, key: c.recordID })) : sectionData}
          renderItem={renderItem}
          keyExtractor={(item) => item.key}
          ListEmptyComponent={renderEmptyList}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </>
  );
};

export default ContactsScreen;
