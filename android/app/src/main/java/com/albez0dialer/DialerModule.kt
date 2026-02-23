package com.albez0dialer

import android.app.role.RoleManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.telecom.CallAudioState
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.util.Log
import androidx.annotation.RequiresApi
import com.albez0dialer.telecom.CallManager
import com.albez0dialer.telecom.MyConnectionService
import com.albez0dialer.telecom.MyInCallService
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * DialerModule - React Native bridge for Android Telecom Framework
 * 
 * This module exposes native Android telephony capabilities to React Native.
 * It handles:
 * - Default dialer role management
 * - Outgoing call placement
 * - Call control (answer, reject, end, hold, mute, speaker)
 * - Phone account registration
 * - Event emission to JavaScript
 * 
 * JavaScript Usage:
 * import { NativeModules, NativeEventEmitter } from 'react-native';
 * const { DialerModule } = NativeModules;
 * const dialerEmitter = new NativeEventEmitter(DialerModule);
 */
class DialerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "DialerModule"
        private const val PHONE_ACCOUNT_ID = "Albez0Dialer_Account"
        private const val REQUEST_CODE_SET_DEFAULT_DIALER = 1001

        @Volatile
        var instance: DialerModule? = null
            private set
    }

    init {
        instance = this
        Log.d(TAG, "DialerModule instance created and stored")
    }

    private val telecomManager: TelecomManager? by lazy {
        reactApplicationContext.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
    }

    override fun getName(): String {
        return "DialerModule"
    }

    /**
     * Initialize phone account for making calls
     * Must be called once when app starts
     */
    @ReactMethod
    fun initializePhoneAccount(promise: Promise) {
        try {
            val componentName = ComponentName(reactApplicationContext, MyConnectionService::class.java)
            val phoneAccountHandle = PhoneAccountHandle(componentName, PHONE_ACCOUNT_ID)

            val phoneAccount = PhoneAccount.builder(phoneAccountHandle, "Albez0Dialer")
                .setCapabilities(PhoneAccount.CAPABILITY_CALL_PROVIDER)
                .setAddress(Uri.parse("tel:+1234567890")) // Placeholder
                .setShortDescription("Albez0Dialer Account")
                .build()

            telecomManager?.registerPhoneAccount(phoneAccount)
            Log.d(TAG, "Phone account registered successfully")
            promise.resolve("Phone account initialized")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize phone account", e)
            promise.reject("INIT_ERROR", e.message)
        }
    }

    /**
     * Request to become the default dialer app
     * Opens system dialog for user to grant permission
     * 
     * JavaScript:
     * await DialerModule.requestDialerRole();
     */
    @ReactMethod
    fun requestDialerRole(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                requestDialerRoleApi29Plus(promise)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                requestDialerRoleApi23Plus(promise)
            } else {
                promise.reject("VERSION_ERROR", "Android version must be 6.0 (API 23) or higher")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to request dialer role", e)
            promise.reject("REQUEST_ERROR", e.message)
        }
    }

    /**
     * Request dialer role for Android 10+ (API 29+)
     * Uses RoleManager
     */
    @RequiresApi(Build.VERSION_CODES.Q)
    private fun requestDialerRoleApi29Plus(promise: Promise) {
        val roleManager = reactApplicationContext.getSystemService(Context.ROLE_SERVICE) as RoleManager

        if (roleManager.isRoleAvailable(RoleManager.ROLE_DIALER)) {
            if (roleManager.isRoleHeld(RoleManager.ROLE_DIALER)) {
                Log.d(TAG, "App is already default dialer")
                promise.resolve("Already default dialer")
            } else {
                val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER)
                reactApplicationContext.currentActivity?.startActivityForResult(intent, REQUEST_CODE_SET_DEFAULT_DIALER)
                promise.resolve("Dialer role request sent")
            }
        } else {
            promise.reject("ROLE_ERROR", "Dialer role not available on this device")
        }
    }

    /**
     * Request dialer role for Android 6-9 (API 23-28)
     * Uses TelecomManager
     */
    private fun requestDialerRoleApi23Plus(promise: Promise) {
        val packageName = reactApplicationContext.packageName
        val defaultDialer = telecomManager?.defaultDialerPackage

        if (defaultDialer == packageName) {
            Log.d(TAG, "App is already default dialer")
            promise.resolve("Already default dialer")
        } else {
            val intent = Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER)
            intent.putExtra(TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME, packageName)
            reactApplicationContext.currentActivity?.startActivityForResult(intent, REQUEST_CODE_SET_DEFAULT_DIALER)
            promise.resolve("Dialer role request sent")
        }
    }

    /**
     * Check if app is currently the default dialer
     * 
     * JavaScript:
     * const isDefault = await DialerModule.isDefaultDialer();
     */
    @ReactMethod
    fun isDefaultDialer(promise: Promise) {
        try {
            val packageName = reactApplicationContext.packageName
            val defaultDialer = telecomManager?.defaultDialerPackage
            val isDefault = defaultDialer == packageName

            Log.d(TAG, "Is default dialer: $isDefault (current: $defaultDialer)")
            promise.resolve(isDefault)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to check default dialer status", e)
            promise.reject("CHECK_ERROR", e.message)
        }
    }

    /**
     * Place an outgoing call using Android Telecom Framework
     * This will route through MyConnectionService
     * 
     * JavaScript:
     * await DialerModule.startOutgoingCall('+1234567890');
     */
    @ReactMethod
    fun startOutgoingCall(phoneNumber: String, promise: Promise) {
        try {
            Log.d(TAG, "Starting outgoing call to: $phoneNumber")

            // Create phone account handle
            val componentName = ComponentName(reactApplicationContext, MyConnectionService::class.java)
            val phoneAccountHandle = PhoneAccountHandle(componentName, PHONE_ACCOUNT_ID)

            // Create call URI
            val callUri = Uri.fromParts("tel", phoneNumber, null)

            // Build extras
            val extras = android.os.Bundle().apply {
                putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, phoneAccountHandle)
                putBoolean(TelecomManager.EXTRA_START_CALL_WITH_SPEAKERPHONE, false)
            }

            // Place call through TelecomManager
            telecomManager?.placeCall(callUri, extras)

            Log.d(TAG, "Call placed successfully")
            promise.resolve("Call started")
        } catch (e: SecurityException) {
            Log.e(TAG, "Permission denied for placing call", e)
            promise.reject("PERMISSION_ERROR", "Missing CALL_PHONE or MANAGE_OWN_CALLS permission")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to place call", e)
            promise.reject("CALL_ERROR", e.message)
        }
    }

    /**
     * Answer an incoming call
     * 
     * JavaScript:
     * DialerModule.answerCall();
     */
    @ReactMethod
    fun answerCall(promise: Promise) {
        try {
            val callInfo = com.albez0dialer.telecom.CallManager.getPrimaryCall()
            
            if (callInfo != null && callInfo.call != null) {
                callInfo.call.answer(0) // 0 = default video state (audio only)
                Log.d(TAG, "Call answered")
                promise.resolve("Call answered")
            } else {
                promise.reject("NO_CALL", "No active call to answer")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to answer call", e)
            promise.reject("ANSWER_ERROR", e.message)
        }
    }

    /**
     * Reject an incoming call
     * 
     * JavaScript:
     * DialerModule.rejectCall();
     */
    @ReactMethod
    fun rejectCall(promise: Promise) {
        try {
            val callInfo = com.albez0dialer.telecom.CallManager.getPrimaryCall()
            
            if (callInfo != null && callInfo.call != null) {
                callInfo.call.reject(false, null) // Reject without message
                Log.d(TAG, "Call rejected")
                promise.resolve("Call rejected")
            } else {
                promise.reject("NO_CALL", "No active call to reject")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to reject call", e)
            promise.reject("REJECT_ERROR", e.message)
        }
    }

    /**
     * End/disconnect the active call
     * 
     * JavaScript:
     * DialerModule.endCall();
     */
    @ReactMethod
    fun endCall(promise: Promise) {
        try {
            val callInfo = com.albez0dialer.telecom.CallManager.getPrimaryCall()
            
            if (callInfo != null && callInfo.call != null) {
                callInfo.call.disconnect()
                Log.d(TAG, "Call disconnected")
                promise.resolve("Call ended")
            } else {
                promise.reject("NO_CALL", "No active call to end")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to end call", e)
            promise.reject("END_ERROR", e.message)
        }
    }

    /**
     * Toggle mute on/off
     * 
     * JavaScript:
     * DialerModule.toggleMute(true); // mute
     * DialerModule.toggleMute(false); // unmute
     */
    @ReactMethod
    fun toggleMute(mute: Boolean, promise: Promise) {
        try {
            val service = MyInCallService.instance
            if (service != null) {
                service.setMuted(mute)
                Log.d(TAG, "Mute set to: $mute via InCallService")
                promise.resolve("Mute set to $mute")
            } else {
                Log.w(TAG, "InCallService not available for mute")
                promise.reject("NO_SERVICE", "InCallService not available")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to toggle mute", e)
            promise.reject("MUTE_ERROR", e.message)
        }
    }

    /**
     * Toggle speaker on/off
     */
    @ReactMethod
    fun toggleSpeaker(speaker: Boolean, promise: Promise) {
        try {
            val service = MyInCallService.instance
            if (service != null) {
                if (speaker) {
                    service.setAudioRoute(CallAudioState.ROUTE_SPEAKER)
                } else {
                    service.setAudioRoute(CallAudioState.ROUTE_EARPIECE)
                }
                Log.d(TAG, "Speaker set to: $speaker via InCallService")
                promise.resolve("Speaker set to $speaker")
            } else {
                Log.w(TAG, "InCallService not available for speaker")
                promise.reject("NO_SERVICE", "InCallService not available")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to toggle speaker", e)
            promise.reject("SPEAKER_ERROR", e.message)
        }
    }

    /**
     * Get current call state from CallManager
     * Used by JS to sync state on mount (handles missed events)
     */
    @ReactMethod
    fun getCallState(promise: Promise) {
        try {
            val callInfo = CallManager.getPrimaryCall()
            if (callInfo != null) {
                val result = Arguments.createMap().apply {
                    putString("callId", callInfo.callId)
                    putString("state", CallManager.stateToString(callInfo.state))
                    putString("phoneNumber", callInfo.phoneNumber)
                    putString("callerName", callInfo.callerName)
                    putString("direction", callInfo.direction.name.lowercase())
                    putBoolean("hasActiveCall", true)
                }
                Log.d(TAG, "getCallState: active call found - ${callInfo.callId}, state=${CallManager.stateToString(callInfo.state)}")
                promise.resolve(result)
            } else {
                val result = Arguments.createMap().apply {
                    putBoolean("hasActiveCall", false)
                }
                promise.resolve(result)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get call state", e)
            promise.reject("STATE_ERROR", e.message)
        }
    }

    /**
     * Toggle hold on/off
     * 
     * JavaScript:
     * DialerModule.toggleHold(true); // put on hold
     * DialerModule.toggleHold(false); // resume
     */
    @ReactMethod
    fun toggleHold(hold: Boolean, promise: Promise) {
        try {
            val callInfo = com.albez0dialer.telecom.CallManager.getPrimaryCall()
            
            if (callInfo != null && callInfo.call != null) {
                if (hold) {
                    callInfo.call.hold()
                    Log.d(TAG, "Call put on hold")
                } else {
                    callInfo.call.unhold()
                    Log.d(TAG, "Call resumed from hold")
                }
                promise.resolve("Hold set to $hold")
            } else {
                promise.reject("NO_CALL", "No active call")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to toggle hold", e)
            promise.reject("HOLD_ERROR", e.message)
        }
    }

    /**
     * Send a DTMF tone during an active call
     * 
     * JavaScript:
     * await DialerModule.sendDtmf('5');
     */
    @ReactMethod
    fun sendDtmf(digit: String, promise: Promise) {
        try {
            val callInfo = CallManager.getPrimaryCall()
            if (callInfo?.call != null) {
                val char = digit.firstOrNull()
                if (char != null) {
                    callInfo.call.playDtmfTone(char)
                    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                        try { callInfo.call.stopDtmfTone() } catch (_: Exception) {}
                    }, 200)
                    Log.d(TAG, "DTMF tone sent: $digit")
                    promise.resolve("DTMF sent: $digit")
                } else {
                    promise.reject("INVALID_DIGIT", "Invalid DTMF digit")
                }
            } else {
                promise.reject("NO_CALL", "No active call for DTMF")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send DTMF", e)
            promise.reject("DTMF_ERROR", e.message)
        }
    }

    /**
     * Set specific audio route (earpiece, speaker, bluetooth)
     * Route constants from CallAudioState:
     *   1 = ROUTE_EARPIECE
     *   2 = ROUTE_BLUETOOTH  
     *   4 = ROUTE_WIRED_HEADSET
     *   8 = ROUTE_SPEAKER
     * 
     * JavaScript:
     * await DialerModule.setAudioRoute(8); // speaker
     */
    @ReactMethod
    fun setAudioRoute(route: Int, promise: Promise) {
        try {
            val service = MyInCallService.instance
            if (service != null) {
                service.setAudioRoute(route)
                Log.d(TAG, "Audio route set to: $route")
                promise.resolve("Audio route set to $route")
            } else {
                promise.reject("NO_SERVICE", "InCallService not available")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set audio route", e)
            promise.reject("ROUTE_ERROR", e.message)
        }
    }

    /**
     * Get available audio routes and current route
     * 
     * JavaScript:
     * const info = await DialerModule.getAvailableAudioRoutes();
     * // { routes: [{name, route, active}], currentRoute: 1, isMuted: false }
     */
    @ReactMethod
    fun getAvailableAudioRoutes(promise: Promise) {
        try {
            val service = MyInCallService.instance
            if (service != null) {
                val audioState = service.callAudioState
                val routes = Arguments.createArray()

                // Earpiece
                if ((audioState.supportedRouteMask and CallAudioState.ROUTE_EARPIECE) != 0) {
                    routes.pushMap(Arguments.createMap().apply {
                        putString("name", "Earpiece")
                        putInt("route", CallAudioState.ROUTE_EARPIECE)
                        putBoolean("active", audioState.route == CallAudioState.ROUTE_EARPIECE)
                    })
                }

                // Speaker
                if ((audioState.supportedRouteMask and CallAudioState.ROUTE_SPEAKER) != 0) {
                    routes.pushMap(Arguments.createMap().apply {
                        putString("name", "Speaker")
                        putInt("route", CallAudioState.ROUTE_SPEAKER)
                        putBoolean("active", audioState.route == CallAudioState.ROUTE_SPEAKER)
                    })
                }

                // Bluetooth
                if ((audioState.supportedRouteMask and CallAudioState.ROUTE_BLUETOOTH) != 0) {
                    routes.pushMap(Arguments.createMap().apply {
                        putString("name", "Bluetooth")
                        putInt("route", CallAudioState.ROUTE_BLUETOOTH)
                        putBoolean("active", audioState.route == CallAudioState.ROUTE_BLUETOOTH)
                    })
                }

                // Wired headset
                if ((audioState.supportedRouteMask and CallAudioState.ROUTE_WIRED_HEADSET) != 0) {
                    routes.pushMap(Arguments.createMap().apply {
                        putString("name", "Wired Headset")
                        putInt("route", CallAudioState.ROUTE_WIRED_HEADSET)
                        putBoolean("active", audioState.route == CallAudioState.ROUTE_WIRED_HEADSET)
                    })
                }

                val result = Arguments.createMap().apply {
                    putArray("routes", routes)
                    putInt("currentRoute", audioState.route)
                    putBoolean("isMuted", audioState.isMuted)
                }
                promise.resolve(result)
            } else {
                promise.reject("NO_SERVICE", "InCallService not available")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get audio routes", e)
            promise.reject("ROUTE_ERROR", e.message)
        }
    }

    /**
     * Send event to React Native JavaScript
     */
    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    /**
     * Public method for MyInCallService to send call state events to React Native
     * This is needed because InCallService runs in a different context
     */
    fun sendCallStateEvent(type: String, state: String, phoneNumber: String = "", callerName: String = "") {
        try {
            val params = Arguments.createMap().apply {
                putString("type", type)
                putString("state", state)
                if (phoneNumber.isNotEmpty()) putString("phoneNumber", phoneNumber)
                if (callerName.isNotEmpty()) putString("callerName", callerName)
            }
            sendEvent("CALL_STATE_CHANGED", params)
            Log.d(TAG, "Sent $type event to React Native: state=$state, number=$phoneNumber")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send call state event", e)
        }
    }

    /**
     * Enhanced method for sending comprehensive call events with all data
     * Used by production CallManager integration
     */
    fun sendCallEvent(
        eventType: String,
        callId: String,
        state: String,
        phoneNumber: String,
        callerName: String,
        direction: String,
        disconnectCause: String
    ) {
        try {
            val params = Arguments.createMap().apply {
                putString("type", eventType)
                putString("callId", callId)
                putString("state", state)
                putString("phoneNumber", phoneNumber)
                putString("callerName", callerName)
                putString("direction", direction)
                if (disconnectCause.isNotEmpty()) putString("disconnectCause", disconnectCause)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }
            sendEvent("CALL_STATE_CHANGED", params)
            Log.d(TAG, "✓ Sent $eventType event to React Native: callId=$callId, state=$state")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send call event", e)
        }
    }

    /**
     * Test method to simulate incoming call for debugging
     * JavaScript: await DialerModule.testIncomingCall('+1234567890', 'Test Caller');
     */
    /**
     * Required for NativeEventEmitter
     */
    @ReactMethod
    fun addListener(eventName: String?) {
        // Required for NativeEventEmitter - no-op
    }

    /**
     * Required for NativeEventEmitter
     */
    @ReactMethod
    fun removeListeners(count: Int?) {
        // Required for NativeEventEmitter - no-op
    }

    @ReactMethod
    fun testIncomingCall(phoneNumber: String, callerName: String, promise: Promise) {
        try {
            Log.d(TAG, "Simulating incoming call from $callerName ($phoneNumber)")
            sendCallStateEvent("CALL_ADDED", "incoming", phoneNumber, callerName)
            promise.resolve("Test incoming call sent")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send test incoming call", e)
            promise.reject("TEST_ERROR", e.message)
        }
    }
}
