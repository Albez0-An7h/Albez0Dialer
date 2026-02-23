import React, { useRef, useState, useMemo, useCallback } from 'react';
import { View, Text, Animated, PanResponder, Dimensions, Vibration } from 'react-native';

const { width } = Dimensions.get('window');
const DIAL_SIZE = width * 0.82;
const INNER_SIZE = DIAL_SIZE * 0.88;
const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
const SEGMENT_ANGLE = 360 / NUMBERS.length; // 36° per number
const MIN_ROTATION = 30; // Minimum clockwise degrees to register a dial
const NUMBER_RADIUS = (INNER_SIZE / 2) * 0.72;
const NUMBER_SIZE = 54;
const CENTER = DIAL_SIZE / 2;

const RotaryDial = ({ onNumberDialed }) => {
  const rotation = useRef(new Animated.Value(0)).current;
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Mutable refs for PanResponder (avoids stale closures)
  const startAngleRef = useRef(0);
  const currentRotationRef = useRef(0);
  const touchedNumberRef = useRef(null);
  const callbackRef = useRef(onNumberDialed);

  // Keep callback ref in sync with latest prop
  callbackRef.current = onNumberDialed;

  // Angle from center of dial in degrees (0-360)
  const getTouchAngle = useCallback((x, y) => {
    let angle = Math.atan2(y - CENTER, x - CENTER) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    return angle;
  }, []);

  // Offset from center for number at index
  const getNumberOffset = useCallback((index) => {
    const angle = (index * SEGMENT_ANGLE) - 90; // start at top
    const radians = (angle * Math.PI) / 180;
    return {
      x: NUMBER_RADIUS * Math.cos(radians),
      y: NUMBER_RADIUS * Math.sin(radians),
    };
  }, []);

  // Detect which number was touched (coordinates relative to outer ring)
  const getTouchedNumber = useCallback((x, y) => {
    const touchDist = Math.sqrt((x - CENTER) ** 2 + (y - CENTER) ** 2);

    // Must touch within the number ring zone
    if (touchDist < NUMBER_RADIUS * 0.45 || touchDist > CENTER * 0.96) return null;

    let closest = null;
    let closestDist = Infinity;

    for (let i = 0; i < NUMBERS.length; i++) {
      const off = getNumberOffset(i);
      const dist = Math.sqrt((x - (CENTER + off.x)) ** 2 + (y - (CENTER + off.y)) ** 2);
      if (dist < closestDist) {
        closestDist = dist;
        closest = NUMBERS[i];
      }
    }

    return closestDist < NUMBER_SIZE * 1.2 ? closest : null;
  }, [getNumberOffset]);

  // PanResponder lives on the OUTER (non-rotating) ring so touch coordinates
  // are always in a fixed frame — no transform-related coordinate issues.
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dx) > 3 || Math.abs(gs.dy) > 3,

    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      const num = getTouchedNumber(locationX, locationY);

      touchedNumberRef.current = num;
      setSelectedNumber(num);
      startAngleRef.current = getTouchAngle(locationX, locationY);
      currentRotationRef.current = 0;
      setIsDragging(true);

      if (num !== null) {
        try { Vibration.vibrate(10); } catch (_) {}
      }
    },

    onPanResponderMove: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      const currentAngle = getTouchAngle(locationX, locationY);

      let delta = currentAngle - startAngleRef.current;
      if (delta < -180) delta += 360;
      else if (delta > 180) delta -= 360;

      // Only accumulate clockwise (positive) rotation
      if (delta > 0) {
        const newRot = Math.min(currentRotationRef.current + delta, 330);
        currentRotationRef.current = newRot;
        rotation.setValue(newRot);
      }

      // Always update reference angle for next frame
      startAngleRef.current = currentAngle;
    },

    onPanResponderRelease: () => {
      setIsDragging(false);
      const finalRot = currentRotationRef.current;
      const num = touchedNumberRef.current;

      // Spring back to 0
      Animated.spring(rotation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }).start();

      // Register the number if rotated past threshold
      if (num !== null && finalRot >= MIN_ROTATION) {
        try { Vibration.vibrate(30); } catch (_) {}
        callbackRef.current?.(num);
      }

      // Reset
      currentRotationRef.current = 0;
      startAngleRef.current = 0;
      touchedNumberRef.current = null;
      setSelectedNumber(null);
    },
  }), [getTouchAngle, getTouchedNumber, rotation]);

  const rotateStr = rotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {/* Outer ring — fixed, receives all touches */}
      <View
        style={{
          width: DIAL_SIZE,
          height: DIAL_SIZE,
          borderRadius: DIAL_SIZE / 2,
          backgroundColor: '#111128',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.06)',
        }}
        {...panResponder.panHandlers}
      >
        {/* Inner rotating dial (visual only, no touch interception) */}
        <Animated.View
          pointerEvents="none"
          style={{
            width: INNER_SIZE,
            height: INNER_SIZE,
            borderRadius: INNER_SIZE / 2,
            backgroundColor: '#0d0d24',
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ rotate: rotateStr }],
          }}
        >
          {/* Center dot */}
          <View
            style={{
              width: DIAL_SIZE * 0.14,
              height: DIAL_SIZE * 0.14,
              borderRadius: (DIAL_SIZE * 0.14) / 2,
              backgroundColor: '#080818',
              position: 'absolute',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.04)',
            }}
          />

          {/* Number circles */}
          {NUMBERS.map((number, index) => {
            const off = getNumberOffset(index);
            const isSelected = selectedNumber === number;

            return (
              <View
                key={number}
                style={{
                  position: 'absolute',
                  left: (INNER_SIZE / 2) + off.x - NUMBER_SIZE / 2,
                  top: (INNER_SIZE / 2) + off.y - NUMBER_SIZE / 2,
                  width: NUMBER_SIZE,
                  height: NUMBER_SIZE,
                  borderRadius: NUMBER_SIZE / 2,
                  backgroundColor: isSelected ? '#22c55e' : 'rgba(255,255,255,0.05)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: isSelected ? '#22c55e' : 'rgba(255,255,255,0.08)',
                }}
              >
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: '600',
                    color: isSelected ? '#000' : '#fff',
                  }}
                >
                  {number}
                </Text>
              </View>
            );
          })}

          {/* Rotation indicator line */}
          {isDragging && (
            <View
              style={{
                position: 'absolute',
                width: 3,
                height: INNER_SIZE * 0.16,
                top: INNER_SIZE * 0.05,
                left: (INNER_SIZE / 2) - 1.5,
                backgroundColor: '#22c55e',
                borderRadius: 1.5,
                opacity: 0.5,
              }}
            />
          )}
        </Animated.View>
      </View>

      {/* Instruction */}
      <Text
        style={{
          color: 'rgba(255,255,255,0.25)',
          fontSize: 13,
          marginTop: 16,
          fontWeight: '300',
        }}
      >
        Touch a number · drag clockwise to dial
      </Text>
    </View>
  );
};

export default RotaryDial;
