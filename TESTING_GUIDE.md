# Incoming Call & Call State Testing Guide

## Current Status

✅ **App successfully built and deployed** with the following fixes:
1. **App.tsx**: Added incoming call detection via `CALL_STATE_CHANGED` listener
2. **DialerModule.kt**: Added `testIncomingCall()` method for manual testing
3. **MyInCallService.kt**: Improved `getDialerModule()` with detailed logging
4. **CallerScreen.js**: Enhanced event handling and auto-close functionality
5. **DialerScreen.js**: Added test button (📲) for simulating incoming calls

## Testing Steps

### Step 1: Check App Status
1. Open the app on your Android device
2. Look for the **red banner** at the top: "⚠️ Tap to set as Default Dialer"
3. **Tap the banner** and select this app as the default dialer

### Step 2: Test Manual Incoming Call Simulation
1. Go to **Dialer tab**
2. Look for the **📲 button** (orange, smaller button on the left)
3. **Tap the 📲 button** to simulate an incoming call
4. **Expected behavior**:
   - CallerScreen should open automatically
   - Shows "Test Caller" and "+1234567890"
   - Display "Incoming call..." status
   - Shows green **📞 Accept** and red **📵 Decline** buttons

### Step 3: Test Accept/Decline Buttons
1. After triggering test incoming call:
2. **Tap Accept (📞)**: Should change to "Call in progress" with timer
3. **Tap End Call**: Should show "Call ended" and auto-close after 1.5s

OR:

1. **Tap Decline (📵)**: Should show "Call ended" and auto-close immediately

### Step 4: Test Real Outgoing Calls
1. Enter a phone number in the dialer
2. **Tap Call (📞)**:
   - CallerScreen opens with "Calling..." 
   - When other party **answers**: Should change to "Call in progress" with timer
   - When other party **rejects/hangs up**: Should auto-close after 1.5s

### Step 5: Test Real Incoming Calls
1. Have someone call your phone
2. **Expected behavior**:
   - CallerScreen should **automatically open**
   - Shows caller's name/number
   - Accept/Decline buttons work
   - State updates correctly when answered

## Debugging Commands

Open terminal and run these to see all logs:

```bash
# Watch all call-related logs
adb logcat | grep -E "App:|CallerScreen:|MyInCallService|DialerModule"

# Watch only event flow
adb logcat | grep -E "CALL_STATE_CHANGED|CALL_ADDED|STATE_CHANGED|CALL_REMOVED"

# Watch only JavaScript logs
adb logcat | grep -E "ReactNativeJS"
```

## Expected Log Messages

### When Test Button (📲) is Pressed:
```
DialerModule: Simulating incoming call from Test Caller (+1234567890)
DialerModule: Sent CALL_ADDED event to React Native: state=incoming, number=+1234567890
App: Received CALL_STATE_CHANGED event: {type: "CALL_ADDED", state: "incoming", phoneNumber: "+1234567890", callerName: "Test Caller"}
App: Incoming call detected, opening CallerScreen
CallerScreen: Setting up CALL_STATE_CHANGED listener
CallerScreen: Native call event received: {type: "CALL_ADDED", state: "incoming", ...}
```

### When Real Call is Placed:
```
MyInCallService: onCallAdded
MyInCallService: Call added - Number: +1234567890, State: 1
MyInCallService: Attempting to get DialerModule...
MyInCallService: Successfully obtained DialerModule
MyInCallService: Sent CALL_ADDED event: state=outgoing, number=+1234567890
CallerScreen: CALL_ADDED - state: outgoing
```

### When Call is Answered:
```
MyInCallService: Call state changed: 4
MyInCallService: Sent STATE_CHANGED event: active
CallerScreen: STATE_CHANGED - new state: active
CallerScreen: Call is now ACTIVE
```

### When Call Ends:
```
MyInCallService: onCallRemoved
MyInCallService: Sent CALL_REMOVED event
CallerScreen: CALL_REMOVED - closing screen
CallerScreen: Auto-closing after CALL_REMOVED
```

## Troubleshooting

### Issue 1: Test Button (📲) Does Nothing
**Check**: 
- Look for DialerModule logs: "Simulating incoming call..."
- If no logs, DialerModule might not be loaded

**Solution**: Restart app or rebuild

### Issue 2: No Auto-Open for Incoming Calls
**Check**: 
- App.tsx logs: "App: Setting up incoming call listener"
- App.tsx logs: "App: Received CALL_STATE_CHANGED event"

**Solution**: Ensure app has ANSWER_PHONE_CALLS permission

### Issue 3: CallerScreen Opens But No Accept/Decline Buttons
**Check**: 
- CallerScreen state: should be "incoming"
- Look for "callState === 'incoming'" in logs

**Solution**: Check event data structure

### Issue 4: Buttons Don't Work
**Check**: 
- "CallerScreen: User pressed Accept/Decline button" logs
- Native module response logs

**Solution**: Check DialerModule methods are working

### Issue 5: No State Updates During Real Calls
**Check**: 
- MyInCallService logs: "Successfully obtained DialerModule"
- If "DialerModule not found": React Native bridge issue

**Solution**: 
1. Restart app completely
2. Check if app is registered as default dialer
3. Rebuild app: `npx react-native run-android`

## Key Points

1. **📲 Test Button**: Use this first to verify incoming call flow works
2. **Default Dialer**: Must be set or calls won't work
3. **Permissions**: CALL_PHONE, READ_PHONE_STATE, ANSWER_PHONE_CALLS required
4. **Event Flow**: Native → DialerModule → App.tsx → CallerScreen
5. **Auto-Close**: 60s timeout for outgoing, immediate for ended calls

## Next Steps After Testing

Based on your test results, we can:
1. **If test button works but real calls don't**: Fix native event detection
2. **If events flow but UI doesn't update**: Fix React Native state management
3. **If everything works**: Remove test button and finalize
4. **If incoming calls don't auto-open**: Fix App.tsx listener

Please test these scenarios and let me know what happens! The detailed logs will help identify exactly where any issues occur.