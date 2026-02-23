import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Alert,
  Vibration,
  NativeModules,
  PermissionsAndroid,
  Platform,
  Modal,
  FlatList,
  TextInput,
  Image,
} from 'react-native';
import Contacts from 'react-native-contacts';
import { getFavourites, addFavourite, removeFavourite } from '../utils/storage';

const { DialerModule } = NativeModules;
const ME_SIZE = 68;
const NODE_SIZE = 54;

const FavouritesScreen = ({ onCall }) => {
  const [favourites, setFavourites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [allContacts, setAllContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [favouriteIds, setFavouriteIds] = useState(new Set());
  const [graphSize, setGraphSize] = useState({ w: Dimensions.get('window').width, h: 400 });

  useEffect(() => { loadFavourites(); }, []);

  const loadFavourites = async () => {
    setLoading(true);
    try {
      const favs = await getFavourites();
      setFavourites(favs);
      setFavouriteIds(new Set(favs.map((f) => f.recordID)));
    } catch (e) {
      console.error('Error loading favourites:', e);
    }
    setLoading(false);
  };

  const loadAllContacts = async () => {
    try {
      const list = await Contacts.getAll();
      setAllContacts(list.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '')));
    } catch (e) {
      console.error('Error loading contacts:', e);
    }
  };

  const handleOpenAddModal = async () => {
    if (allContacts.length === 0) await loadAllContacts();
    setSearchQuery('');
    setShowAddModal(true);
  };

  const handleToggleFav = async (contact) => {
    const isFav = favouriteIds.has(contact.recordID);
    try {
      Vibration.vibrate(50);
      if (isFav) {
        const updated = await removeFavourite(contact.recordID);
        setFavourites(updated);
        setFavouriteIds((prev) => { const s = new Set(prev); s.delete(contact.recordID); return s; });
      } else {
        const updated = await addFavourite(contact);
        setFavourites(updated);
        setFavouriteIds((prev) => new Set([...prev, contact.recordID]));
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to update');
    }
  };

  const handleRemoveFavourite = (contact) => {
    Alert.alert('Remove', `Remove ${contact.displayName || 'this contact'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          Vibration.vibrate(50);
          try {
            const updated = await removeFavourite(contact.recordID);
            setFavourites(updated);
            setFavouriteIds((prev) => { const s = new Set(prev); s.delete(contact.recordID); return s; });
          } catch (e) { Alert.alert('Error', 'Failed to remove'); }
        },
      },
    ]);
  };

  const handleCallContact = async (contact) => {
    const phoneNumber = contact.phoneNumbers?.[0]?.number;
    if (!phoneNumber) { Alert.alert('No Number', 'This contact has no phone number'); return; }
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CALL_PHONE);
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
            profilePicture: contact.hasThumbnail && contact.thumbnailPath ? contact.thumbnailPath : null,
          });
        }
      }
    } catch (error) {
      Alert.alert('Call Failed', error.message);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  };

  // ────────────── Graph layout ──────────────
  const cx = graphSize.w / 2;
  const cy = graphSize.h / 2;
  const maxRadius = Math.min(graphSize.w, graphSize.h) * 0.38;

  const getNodePositions = useCallback(() => {
    const count = favourites.length;
    if (count === 0) return [];

    // Two-ring layout for many contacts
    const innerMax = 6;
    const innerCount = Math.min(count, innerMax);
    const outerCount = count > innerMax ? count - innerMax : 0;
    const innerR = outerCount > 0 ? maxRadius * 0.55 : maxRadius;
    const outerR = maxRadius;

    const positions = [];
    // Inner ring
    for (let i = 0; i < innerCount; i++) {
      const angle = (2 * Math.PI * i) / innerCount - Math.PI / 2;
      positions.push({ x: cx + innerR * Math.cos(angle), y: cy + innerR * Math.sin(angle) });
    }
    // Outer ring
    for (let i = 0; i < outerCount; i++) {
      const angle = (2 * Math.PI * i) / outerCount - Math.PI / 2 + Math.PI / outerCount;
      positions.push({ x: cx + outerR * Math.cos(angle), y: cy + outerR * Math.sin(angle) });
    }
    return positions;
  }, [favourites.length, cx, cy, maxRadius]);

  const positions = getNodePositions();

  // ────────────── Edge line ──────────────
  const EdgeLine = ({ fromX, fromY, toX, toY }) => {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    return (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: midX - length / 2,
          top: midY - 0.5,
          width: length,
          height: 1,
          backgroundColor: 'rgba(250,204,21,0.1)',
          transform: [{ rotate: `${angle}deg` }],
        }}
      />
    );
  };

  // ────────────── Contact node ──────────────
  const ContactNode = ({ contact, x, y }) => {
    const hasPhoto = contact.hasThumbnail && contact.thumbnailPath;
    return (
      <TouchableOpacity
        style={{
          position: 'absolute',
          left: x - NODE_SIZE / 2,
          top: y - NODE_SIZE / 2,
          alignItems: 'center',
          width: NODE_SIZE + 24,
          marginLeft: -12,
        }}
        activeOpacity={0.6}
        onPress={() => handleCallContact(contact)}
        onLongPress={() => handleRemoveFavourite(contact)}
        delayLongPress={500}
      >
        {hasPhoto ? (
          <Image
            source={{ uri: contact.thumbnailPath }}
            style={{
              width: NODE_SIZE, height: NODE_SIZE, borderRadius: NODE_SIZE / 2,
              borderWidth: 1.5, borderColor: 'rgba(250,204,21,0.25)',
            }}
          />
        ) : (
          <View style={{
            width: NODE_SIZE, height: NODE_SIZE, borderRadius: NODE_SIZE / 2,
            backgroundColor: 'rgba(250,204,21,0.06)',
            borderWidth: 1, borderColor: 'rgba(250,204,21,0.2)',
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ color: 'rgba(250,204,21,0.7)', fontSize: 15, fontWeight: '600' }}>
              {getInitials(contact.displayName)}
            </Text>
          </View>
        )}
        <Text
          style={{
            color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '400',
            marginTop: 4, textAlign: 'center',
          }}
          numberOfLines={1}
        >
          {contact.displayName?.split(' ')[0] || '?'}
        </Text>
      </TouchableOpacity>
    );
  };

  // ────────────── Add Modal ──────────────
  const filteredContacts = searchQuery
    ? allContacts.filter((c) => (c.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : allContacts;

  const renderAddModal = () => (
    <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', paddingTop: StatusBar.currentHeight || 44 }}>
        <View style={{ flex: 1, backgroundColor: '#0e0e0e', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
            <Text style={{ flex: 1, color: '#fff', fontSize: 18, fontWeight: '500' }}>Add to Favourites</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)} activeOpacity={0.6}>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>
          {/* Search bar */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
            <TextInput
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)', color: '#fff',
                paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
                fontSize: 14, fontWeight: '300',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
              }}
              placeholder="Search contacts"
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          {/* Contact list */}
          <FlatList
            data={filteredContacts}
            keyExtractor={(c) => c.recordID}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }) => {
              const isFav = favouriteIds.has(item.recordID);
              const phone = item.phoneNumbers?.[0]?.number;
              const hasPhoto = item.hasThumbnail && item.thumbnailPath;
              return (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 11 }}
                  activeOpacity={0.6}
                  onPress={() => handleToggleFav(item)}
                >
                  {hasPhoto ? (
                    <Image source={{ uri: item.thumbnailPath }} style={{
                      width: 38, height: 38, borderRadius: 19, marginRight: 14,
                      backgroundColor: 'rgba(255,255,255,0.06)',
                    }} />
                  ) : (
                    <View style={{
                      width: 38, height: 38, borderRadius: 19, marginRight: 14,
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      justifyContent: 'center', alignItems: 'center',
                    }}>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '500' }}>
                        {getInitials(item.displayName)}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '400' }} numberOfLines={1}>
                      {item.displayName || 'Unknown'}
                    </Text>
                    {phone && (
                      <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: '300', marginTop: 1 }}>
                        {phone}
                      </Text>
                    )}
                  </View>
                  <View style={{
                    width: 28, height: 28, borderRadius: 14,
                    backgroundColor: isFav ? 'rgba(250,204,21,0.15)' : 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: isFav ? 'rgba(250,204,21,0.3)' : 'rgba(255,255,255,0.06)',
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 14, opacity: isFav ? 1 : 0.3 }}>{isFav ? '★' : '☆'}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );

  // ────────────── Empty state ──────────────
  const renderEmpty = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 }}>
      <View style={{
        width: ME_SIZE, height: ME_SIZE, borderRadius: ME_SIZE / 2,
        backgroundColor: 'rgba(250,204,21,0.08)',
        borderWidth: 1.5, borderColor: 'rgba(250,204,21,0.2)',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 24,
      }}>
        <Text style={{ color: 'rgba(250,204,21,0.8)', fontSize: 22, fontWeight: '600' }}>Me</Text>
      </View>
      <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: '300', marginBottom: 4 }}>
        No favourites yet
      </Text>
      <Text style={{ color: 'rgba(255,255,255,0.15)', fontSize: 12, fontWeight: '300', textAlign: 'center', paddingHorizontal: 60 }}>
        Tap + to add contacts to your graph
      </Text>
    </View>
  );

  // ────────────── Main render ──────────────
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', paddingTop: StatusBar.currentHeight || 0 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: '300', letterSpacing: -0.5 }}>
              Favourites
            </Text>
            {favourites.length > 0 && (
              <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, fontWeight: '300', marginTop: 4 }}>
                {favourites.length} contact{favourites.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: 'rgba(250,204,21,0.08)',
              borderWidth: 1, borderColor: 'rgba(250,204,21,0.2)',
              justifyContent: 'center', alignItems: 'center',
            }}
            activeOpacity={0.6}
            onPress={handleOpenAddModal}
          >
            <Text style={{ color: 'rgba(250,204,21,0.8)', fontSize: 22, fontWeight: '300' }}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 20 }} />

        {/* Graph area */}
        {favourites.length === 0 ? renderEmpty() : (
          <View
            style={{ flex: 1 }}
            onLayout={(e) => {
              const { width: w, height: h } = e.nativeEvent.layout;
              setGraphSize({ w, h });
            }}
          >
            {/* Orbit ring hint */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: cx - maxRadius,
                top: cy - maxRadius,
                width: maxRadius * 2,
                height: maxRadius * 2,
                borderRadius: maxRadius,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.03)',
                borderStyle: 'dashed',
              }}
            />

            {/* Edge lines */}
            {positions.map((pos, i) => (
              <EdgeLine key={`e-${i}`} fromX={cx} fromY={cy} toX={pos.x} toY={pos.y} />
            ))}

            {/* Me node (center) */}
            <View
              style={{
                position: 'absolute',
                left: cx - ME_SIZE / 2,
                top: cy - ME_SIZE / 2,
                width: ME_SIZE, height: ME_SIZE, borderRadius: ME_SIZE / 2,
                backgroundColor: 'rgba(250,204,21,0.08)',
                borderWidth: 1.5, borderColor: 'rgba(250,204,21,0.25)',
                justifyContent: 'center', alignItems: 'center',
                zIndex: 10,
              }}
            >
              <Text style={{ color: 'rgba(250,204,21,0.9)', fontSize: 18, fontWeight: '600' }}>Me</Text>
            </View>

            {/* Contact nodes */}
            {favourites.map((fav, i) => positions[i] && (
              <ContactNode key={fav.recordID} contact={fav} x={positions[i].x} y={positions[i].y} />
            ))}

            {/* Hint at bottom */}
            <View style={{ position: 'absolute', bottom: 16, left: 0, right: 0, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.12)', fontSize: 11, fontWeight: '300' }}>
                Tap to call · Long-press to remove
              </Text>
            </View>
          </View>
        )}

        {renderAddModal()}
      </View>
    </>
  );
};

export default FavouritesScreen;
