# Why Actual Calls Are Not Working - Troubleshooting Guide

## 🔴 Root Cause

The Android Telecom Framework requires **your app to be set as the DEFAULT DIALER** to place actual SIM calls. Without this, calls won't go through the telephony system.

---

## ✅ Steps to Fix

### Step 1: Rebuild and Install App

```bash
cd android
./gradlew clean
cd ..
npx react-native run-android
```

### Step 2: Set as Default Dialer

When you open the app, you'll see a **red banner at the top** saying:

> ⚠️ Tap to set as Default Dialer (Required for calls)

**Tap this banner** and follow these steps:

1. System dialog will appear: "Change default Phone app?"
2. Select **Albez0Dialer**
3. Tap **"Set as default"**

### Step 3: Verify Default Dialer Status

After setting as default:
- The red banner should disappear
- You can now place actual SIM calls

### Step 4: Test Call

1. Enter a phone number in the keypad
2. Tap the green call button
3. The call should now route through your actual SIM card

---

## 🔍 How to Verify It's Working

### Check Logcat for These Messages:

```bash
adb logcat | grep -E "DialerModule|MyConnectionService|MyInCallService"
```

**Expected logs when call is placed:**

```
DialerModule: Starting outgoing call to: +1234567890
DialerModule: Call placed successfully
MyConnectionService: onCreateOutgoingConnection: tel:+1234567890
MyConnectionService: Outgoing connection created for: +1234567890
MyInCallService: onCallAdded
MyInCallService: Call added - Number: +1234567890, State: 1
```

**State codes:**
- `1` = DIALING (outgoing)
- `2` = RINGING (incoming)
- `4` = ACTIVE (connected)
- `7` = DISCONNECTED (ended)

---

## 🚨 Common Issues & Solutions

### Issue 1: "Cannot make calls without permission"

**Solution:** Grant CALL_PHONE permission
1. Open Settings → Apps → Albez0Dialer → Permissions
2. Enable "Phone" permission
3. Or, the app will request it automatically when you try to call

### Issue 2: "Dialer module not available"

**Solution:** Module not registered properly
1. Check that DialerPackage is added to MainApplication.kt
2. Rebuild the app completely:
   ```bash
   cd android
   ./gradlew clean
   cd ..
   npx react-native run-android
   ```

### Issue 3: Call starts but nothing happens

**Causes:**
1. Not set as default dialer
2. No SIM card in device
3. Airplane mode is on

**Solution:**
1. Tap the red banner to set as default dialer
2. Ensure device has an active SIM card
3. Turn off airplane mode
4. Check that mobile network is enabled

### Issue 4: "App is not default dialer" even after setting

**Solution:** 
1. Go to Settings → Apps → Default apps → Phone app
2. Manually select Albez0Dialer
3. Restart the app

### Issue 5: Calls work in system dialer but not in your app

**This is expected!** Your app needs to be default dialer. Once you set it:
- System will route all calls through your ConnectionService
- Your CallerScreen will appear instead of system UI
- You'll have full control over call UI

---

## 📋 Required Conditions for Real Calls

✅ App is set as default dialer (CRITICAL)  
✅ Device has active SIM card  
✅ CALL_PHONE permission granted  
✅ READ_PHONE_STATE permission granted  
✅ Phone account initialized (done automatically on app start)  
✅ Not in airplane mode  
✅ Mobile network enabled  

---

## 🧪 Testing Real SIM Calls

### Test 1: Outgoing Call

1. Open app
2. Set as default dialer (red banner)
3. Enter a real phone number
4. Tap green call button
5. **Expected:** Phone should actually dial out through SIM

### Test 2: Incoming Call

1. Set app as default dialer
2. Call your device from another phone
3. **Expected:** Your CallerScreen should appear (not system UI)
4. Tap Accept button
5. **Expected:** Call connects and timer starts

### Test 3: Call Controls

During active call:
- Tap Mute → Should mute microphone
- Tap Speaker → Should enable speakerphone
- Tap Hold → Should put call on hold
- Tap End → Should disconnect call

---

## 🔧 Advanced Troubleshooting

### Check if Phone Account is Registered

```bash
adb logcat | grep "Phone account"
```

Expected output:
```
DialerModule: Phone account registered successfully
```

### Check Default Dialer Status

```bash
adb shell cmd role get-role-holders android.app.role.DIALER
```

Should show:
```
com.albez0dialer
```

### Force Set Default Dialer (if UI doesn't work)

```bash
adb shell cmd role add-role-holder android.app.role.DIALER com.albez0dialer
```

### Check Telecom Manager Permissions

```bash
adb shell dumpsys package com.albez0dialer | grep -A 20 "declared permissions"
```

Should include:
- android.permission.CALL_PHONE
- android.permission.ANSWER_PHONE_CALLS
- android.permission.MANAGE_OWN_CALLS

---

## 📝 What Changed to Fix Calls

### 1. Updated DialerScreen.js
- Now uses `DialerModule.startOutgoingCall()` instead of `Linking.openURL()`
- Added default dialer status check
- Added red banner to prompt setting as default dialer

### 2. Updated RotaryDialScreen.js
- Now uses `DialerModule.startOutgoingCall()` instead of `Linking.openURL()`

### 3. Updated App.tsx
- Added initialization code to register phone account on app start
- Requests required permissions automatically

### 4. Updated MyConnectionService.kt
- Removed simulation code
- Now lets telephony system handle actual call state transitions
- Properly configured for SIM calls

---

## 🎯 Quick Start Checklist

- [ ] Rebuild app: `npx react-native run-android`
- [ ] Tap red "Set as Default Dialer" banner
- [ ] Select Albez0Dialer in system dialog
- [ ] Grant CALL_PHONE permission when prompted
- [ ] Enter a phone number
- [ ] Tap call button
- [ ] Verify actual call is placed

---

## ❓ Still Not Working?

1. **Check Logcat** for error messages:
   ```bash
   adb logcat | grep -E "DialerModule|ERROR"
   ```

2. **Verify Device Requirements:**
   - Android 8.0+ (API 26+)
   - Physical device with SIM card (emulators won't work for real calls)
   - Active mobile network

3. **Try Test Call to a Known Number:**
   - Use your own other phone number
   - Or use a free test number service

4. **Check Android Version:**
   - API 29+ uses RoleManager
   - API 23-28 uses TelecomManager directly
   - Both are handled automatically in the code

---

## 🎉 Success Indicators

When everything is working correctly:

✅ Red banner disappears after setting default dialer  
✅ Console shows "Phone account initialized successfully"  
✅ Console shows "Call initiated via Telecom framework"  
✅ Console shows "onCreateOutgoingConnection" in logcat  
✅ Phone actually dials the number through SIM  
✅ You can hear dial tone  
✅ Call connects to the other party  
✅ CallerScreen UI appears and controls work  

---

**The KEY requirement is setting your app as default dialer. Everything else is already implemented!**
