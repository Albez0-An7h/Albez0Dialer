import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  NativeModules,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

const { DialerModule } = NativeModules;

const SimSelector = ({ visible, onClose, onSelectSim, phoneNumber, contactName }) => {
  const [simCards, setSimCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadSimCards();
    }
  }, [visible]);

  const loadSimCards = async () => {
    setLoading(true);
    try {
      if (DialerModule && DialerModule.getSimCards) {
        const sims = await DialerModule.getSimCards();
        setSimCards(sims || []);
      }
    } catch (error) {
      console.error('Error loading SIM cards:', error);
      setSimCards([]);
    }
    setLoading(false);
  };

  const handleSelectSim = (sim) => {
    onSelectSim(sim);
    onClose();
  };

  const getSimColor = (index) => {
    const colors = ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0'];
    return colors[index % colors.length];
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Select SIM</Text>
            {phoneNumber && (
              <Text style={styles.subtitle} numberOfLines={1}>
                Call {contactName || phoneNumber}
              </Text>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#00bfa5" />
              <Text style={styles.loadingText}>Loading SIMs...</Text>
            </View>
          ) : simCards.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No SIM cards found</Text>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.simList}>
              {simCards.map((sim, index) => (
                <TouchableOpacity
                  key={sim.subscriptionId || index}
                  style={styles.simItem}
                  onPress={() => handleSelectSim(sim)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.simIcon, { backgroundColor: getSimColor(index) }]}>
                    <Text style={styles.simIconText}>{index + 1}</Text>
                  </View>
                  <View style={styles.simInfo}>
                    <Text style={styles.simName}>
                      {sim.displayName || `SIM ${index + 1}`}
                    </Text>
                    <Text style={styles.simCarrier}>
                      {sim.carrierName || 'Unknown Carrier'}
                    </Text>
                    {sim.number && (
                      <Text style={styles.simNumber}>{sim.number}</Text>
                    )}
                  </View>
                  <View style={styles.callIcon}>
                    <Text style={styles.callIconText}>📞</Text>
                  </View>
                </TouchableOpacity>
              ))}

              <TouchableOpacity style={styles.cancelButtonInList} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#1a2a2a',
    borderRadius: 16,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 191, 165, 0.2)',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginTop: 6,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 12,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 15,
    marginBottom: 20,
  },
  simList: {
    padding: 12,
  },
  simItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  simIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  simIconText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  simInfo: {
    flex: 1,
  },
  simName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  simCarrier: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    marginTop: 2,
  },
  simNumber: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    marginTop: 2,
  },
  callIcon: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callIconText: {
    fontSize: 20,
  },
  cancelButton: {
    padding: 14,
    alignItems: 'center',
  },
  cancelButtonInList: {
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelText: {
    color: '#00bfa5',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default SimSelector;
