# Call State & Auto-Close Fix

## Issues Fixed

### 1. **Call State Not Updating (Caller ID doesn't show "picked up")**
**Root Cause**: MyInCallService was trying to send events to React Native by casting `applicationContext as ReactContext`, which fails because InCallService runs in a different context.

**Solution**: 
- Added public `sendCallStateEvent()` method to DialerModule
- Updated MyInCallService to get DialerModule instance from MainApplication
- All events now properly flow: Native → DialerModule → React Native

### 2. **Screen Not Auto-Closing When Call Ends**
**Root Cause**: Multiple issues:
- Events not reaching CallerScreen (due to issue #1)
- CallerScreen not properly handling CALL_REMOVED events
- No fallback mechanism if native events fail

**Solution**:
- Added proper CALL_REMOVED handling in CallerScreen
- Added `finally` blocks to ensure screen always closes
- Reduced close delay from 2000ms to 1500ms for better UX
- Added extensive logging for debugging

### 3. **Edge Cases Handled**

#### a) **Outgoing Call Timeout**
- Added 60-second timeout for outgoing calls
- If call not answered within 60s, screen auto-closes
- Prevents screen getting stuck in "Calling..." state

#### b) **Native Call Failures**
- All call control methods (accept, decline, end) now have `finally` blocks
- Screen closes even if native module throws error
- Immediate state update for better UX before async operation completes

#### c) **State Synchronization**
- Enhanced logging throughout call lifecycle
- CallerScreen logs every state change for debugging
- Native side logs all event emissions

## Changes Made

### Android Native Files

#### 1. `/android/app/src/main/java/com/albez0dialer/DialerModule.kt`
```kotlin
// Added public method for InCallService to send events
fun sendCallStateEvent(type: String, state: String, phoneNumber: String = "", callerName: String = "") {
    // Properly emits events to React Native with all parameters
}
```

#### 2. `/android/app/src/main/java/com/albez0dialer/telecom/MyInCallService.kt`
```kotlin
// Updated to use DialerModule instead of direct ReactContext access
private fun getDialerModule(): com.albez0dialer.DialerModule? {
    val app = application as? com.albez0dialer.MainApplication
    val reactContext = app?.reactNativeHost?.reactInstanceManager?.currentReactContext
    return reactContext?.getNativeModule(com.albez0dialer.DialerModule::class.java)
}

// All event methods now use: dialerModule?.sendCallStateEvent(...)
```

### React Native Files

#### 3. `/screens/CallerScreen.js`
- Enhanced CALL_STATE_CHANGED listener with detailed logging
- Added proper CALL_REMOVED handling
- Added 60s timeout for outgoing calls
- Updated all action handlers (accept, decline, end) with:
  - Immediate state updates (better UX)
  - Comprehensive error handling
  - `finally` blocks to ensure screen closes
  - Detailed console logging

## Testing Checklist

### Scenario 1: Successful Call
1. ✅ Place call from any screen
2. ✅ CallerScreen shows "Calling..."
3. ✅ Other party answers
4. ✅ Screen updates to "Call in progress" with timer
5. ✅ Press End Call
6. ✅ Screen shows "Call ended" briefly
7. ✅ Auto-returns to previous screen (1.5s)

### Scenario 2: Rejected Call
1. ✅ Place call
2. ✅ Other party rejects
3. ✅ Screen auto-updates to "Call ended"
4. ✅ Auto-closes after 1.5s

### Scenario 3: No Answer (Timeout)
1. ✅ Place call
2. ✅ Wait 60 seconds with no answer
3. ✅ Screen shows "Call ended"
4. ✅ Auto-closes after 1.5s

### Scenario 4: Incoming Call
1. ✅ Receive incoming call
2. ✅ Screen shows "Incoming call..."
3. ✅ Press Accept
4. ✅ Screen updates to "Call in progress"
5. ✅ Other party hangs up
6. ✅ Auto-closes

### Scenario 5: User Declines Incoming
1. ✅ Receive incoming call
2. ✅ Press Decline
3. ✅ Screen shows "Call ended"
4. ✅ Auto-closes after 1.5s

## Debugging

### Enable Detailed Logs
```bash
# Watch all call-related logs
adb logcat | grep -E "CallerScreen|MyInCallService|DialerModule|MyConnectionService"
```

### Key Log Messages to Watch For

**CallerScreen (JavaScript)**:
- `CallerScreen: Setting up CALL_STATE_CHANGED listener`
- `CallerScreen: Native call event received: {type, state}`
- `CallerScreen: CALL_ADDED - state: outgoing`
- `CallerScreen: STATE_CHANGED - new state: active`
- `CallerScreen: Call is now ACTIVE`
- `CallerScreen: CALL_REMOVED - closing screen`
- `CallerScreen: Auto-closing after call ended`

**MyInCallService (Native)**:
- `Call state changed: 4` (4 = ACTIVE)
- `Sent STATE_CHANGED event: active`
- `Sent CALL_REMOVED event`

**DialerModule (Native)**:
- `Sent STATE_CHANGED event to React Native: state=active, number=...`
- `Sent CALL_REMOVED event to React Native: state=ended`

## Expected Event Flow

### Outgoing Call Sequence
```
1. User presses call button
   → DialerModule.startOutgoingCall()
   → CallerScreen opens with state: "outgoing"

2. Telephony system dials
   → MyInCallService.onCallAdded()
   → CALL_ADDED event → CallerScreen
   → State: "outgoing"

3. Other party answers
   → Call.Callback.onStateChanged(STATE_ACTIVE)
   → STATE_CHANGED event → CallerScreen
   → State: "active", timer starts

4. Call ends (either party hangs up)
   → MyInCallService.onCallRemoved()
   → CALL_REMOVED event → CallerScreen
   → State: "ended", 1.5s delay, screen closes
```

### Incoming Call Sequence
```
1. Call arrives
   → MyInCallService.onCallAdded(STATE_RINGING)
   → CALL_ADDED event
   → CallerScreen opens with state: "incoming"

2. User accepts
   → DialerModule.answerCall()
   → Call.answer()
   → STATE_CHANGED event (active)
   → State: "active", timer starts

3. Call ends
   → CALL_REMOVED event
   → Auto-close
```

## Troubleshooting

### Issue: "CallerScreen: Native call event received" not appearing in logs
**Solution**: Rebuild the app to include native changes
```bash
cd android && ./gradlew clean && cd ..
npx react-native run-android
```

### Issue: Events received but state not updating
**Check**: 
1. Event type matches expected: "CALL_ADDED", "STATE_CHANGED", "CALL_REMOVED"
2. State value is valid: "incoming", "outgoing", "active", "ended"
3. No JavaScript errors in Metro console

### Issue: Screen not closing
**Check**:
1. `navigation?.goBack()` is being called (check logs)
2. CallerScreen was opened via `onCall` callback from parent
3. `hideCallerScreen()` function exists in App.tsx

## Performance Improvements

1. **Reduced Close Delay**: 2000ms → 1500ms (faster UX)
2. **Immediate State Updates**: UI responds instantly, native confirms async
3. **Timeout Prevention**: 60s timeout prevents stuck screens
4. **Better Error Handling**: Screen always closes, even on errors
5. **Enhanced Logging**: Easier debugging without Android Studio

## Next Steps (Optional Enhancements)

1. **Add call quality indicators**: Signal strength, network type
2. **Add call recording UI**: If legally permitted in region
3. **Add call waiting**: Handle multiple simultaneous calls
4. **Add missed call notifications**: Push notification when screen closed
5. **Add call history sync**: Update CallLogsScreen immediately after call ends
