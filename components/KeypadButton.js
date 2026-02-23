import React from 'react';
import { TouchableOpacity, Text, View, Vibration } from 'react-native';

const KeypadButton = ({ label, subText, onPress }) => {
  const handlePress = () => {
    Vibration.vibrate(30);
    onPress();
  };

  return (
    <TouchableOpacity
      style={{
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(255,255,255,0.06)',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      onPress={handlePress}
      activeOpacity={0.5}
    >
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '400', letterSpacing: 0.5 }}>
          {label}
        </Text>
        {subText ? (
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: '600', marginTop: 1, letterSpacing: 1.5 }}>
            {subText}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

export default KeypadButton;