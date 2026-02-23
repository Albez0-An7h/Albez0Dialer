package com.albez0dialer.telecom

import android.content.Intent
import android.telecom.Call
import android.telecom.DisconnectCause
import android.telecom.InCallService
import android.util.Log
import com.albez0dialer.telecom.CallManager.CallDirection

/**
 * MyInCallService - Production-grade InCallService implementation
 * 
 * This service is THE CORE of Android Telecom integration.
 * It's automatically bound by the system when there's an active call.
 * 
 * Critical responsibilities:
 * - Monitor ALL call lifecycle events
 * - Launch UI for incoming calls (even when app is killed)
 * - Track call state changes and notify app
 * - Handle multiple simultaneous calls
 * - Manage call callbacks properly
 * 
 * The Android system controls this service - we don't start/stop it manually.
 */
class MyInCallService : InCallService(), CallManager.CallStateListener {

    companion object {
        private const val TAG = "MyInCallService"
        
        // Singleton instance for accessing from other components
        @Volatile
        var instance: MyInCallService? = null
            private set
    }
    
    // Map of call callbacks (one per call)
    private val callCallbacks = mutableMapOf<String, Call.Callback>()

    override fun onCreate() {
        super.onCreate()
        instance = this
        CallManager.addListener(this)
        Log.d(TAG, "InCallService created and listening")
    }

    override fun onDestroy() {
        super.onDestroy()
        CallManager.removeListener(this)
        instance = null
        
        // Cleanup callbacks
        callCallbacks.clear()
        
        Log.d(TAG, "InCallService destroyed")
    }

    /**
     * Called by the system when a new call is added
     * 
     * This is THE entry point for all calls (incoming and outgoing)
     * This method is called BEFORE any UI interaction
     * 
     * Critical: We must launch UI here for incoming calls
     */
    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        
        val callId = call.details.handle?.toString() ?: System.currentTimeMillis().toString()
        val phoneNumber = call.details.handle?.schemeSpecificPart ?: "Unknown"
        val callerName = call.details.callerDisplayName?.toString() ?: phoneNumber
        val state = call.state
        
        Log.d(TAG, """\n            ═══════════════════════════════════════════
            CALL ADDED
            ═══════════════════════════════════════════
            Call ID: $callId
            Phone Number: $phoneNumber
            Caller Name: $callerName
            State: $state (${CallManager.stateToString(state)})
            ═══════════════════════════════════════════
        """.trimIndent())

        // Determine direction
        val direction = when (state) {
            Call.STATE_RINGING -> CallDirection.INCOMING
            Call.STATE_DIALING -> CallDirection.OUTGOING
            else -> CallDirection.OUTGOING
        }
        
        // Add to CallManager
        CallManager.addCall(callId, call, phoneNumber, callerName, direction)
        
        // Create and register callback for this call
        val callback = createCallCallback(callId)
        call.registerCallback(callback)
        callCallbacks[callId] = callback
        
        // **CRITICAL: Launch UI for incoming calls**
        if (direction == CallDirection.INCOMING) {
            Log.d(TAG, "⚠️ INCOMING CALL DETECTED - LAUNCHING UI + NOTIFICATION")
            val info = CallManager.getCall(callId)!!
            CallManager.launchIncomingCallUI(applicationContext, info)
            CallNotificationManager.showIncomingCallNotification(applicationContext, info)
        }
        
        // Send event to React Native
        sendEventToReactNative("CALL_ADDED", callId)
    }

    /**
     * Called by the system when a call is removed
     * 
     * This happens when:
     * - Call ends normally
     * - Call is rejected
     * - Call fails
     * - Network error
     */
    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
        
        val callId = call.details.handle?.toString() ?: return
        
        Log.d(TAG, """\n            ═══════════════════════════════════════════
            CALL REMOVED
            ═══════════════════════════════════════════
            Call ID: $callId
            Disconnect Cause: ${call.details.disconnectCause?.description}
            ═══════════════════════════════════════════
        """.trimIndent())
        
        // Update with disconnect cause before removing
        CallManager.updateCallState(callId, Call.STATE_DISCONNECTED, call.details.disconnectCause)
        
        // Show missed call notification if the call was incoming and missed/rejected
        val callInfo = CallManager.getCall(callId)
        if (callInfo != null && callInfo.direction == CallManager.CallDirection.INCOMING) {
            val disconnectCode = call.details.disconnectCause?.code
            if (disconnectCode == DisconnectCause.MISSED ||
                disconnectCode == DisconnectCause.REJECTED ||
                disconnectCode == DisconnectCause.CANCELED) {
                Log.d(TAG, "Missed incoming call detected - showing notification")
                CallNotificationManager.showMissedCallNotification(applicationContext, callInfo)
            }
        }
        
        // Cancel any incoming call notification
        CallNotificationManager.cancelNotification(applicationContext)
        
        // Cancel ongoing call notification
        CallNotificationManager.cancelOngoingNotification(applicationContext)
        
        // Unregister callback
        callCallbacks[callId]?.let { callback ->
            call.unregisterCallback(callback)
            callCallbacks.remove(callId)
        }
        
        // Send event to React Native
        sendEventToReactNative("CALL_REMOVED", callId)
        
        // Remove from CallManager
        CallManager.removeCall(callId)
    }

    /**
     * Create a callback for monitoring call state changes
     */
    private fun createCallCallback(callId: String): Call.Callback {
        val serviceContext = applicationContext
        return object : Call.Callback() {
            
            override fun onStateChanged(call: Call, state: Int) {
                super.onStateChanged(call, state)
                
                Log.d(TAG, """\n                    ───────────────────────────────────────
                    STATE CHANGED: $callId
                    New State: $state (${CallManager.stateToString(state)})
                    ───────────────────────────────────────
                """.trimIndent())
                
                // Cancel incoming notification when call becomes active or disconnected
                if (state == Call.STATE_ACTIVE || state == Call.STATE_DISCONNECTED) {
                    CallNotificationManager.cancelNotification(serviceContext)
                }
                
                // Show/update ongoing call notification for active or holding
                if (state == Call.STATE_ACTIVE || state == Call.STATE_HOLDING) {
                    val updatedInfo = CallManager.getCall(callId)
                    if (updatedInfo != null) {
                        CallNotificationManager.showOngoingCallNotification(serviceContext, updatedInfo)
                    }
                }
                
                // Cancel ongoing notification when disconnected
                if (state == Call.STATE_DISCONNECTED) {
                    CallNotificationManager.cancelOngoingNotification(serviceContext)
                }
                
                // Update CallManager
                CallManager.updateCallState(callId, state)
                
                // Send event to React Native
                sendEventToReactNative("STATE_CHANGED", callId)
            }
            
            override fun onDetailsChanged(call: Call, details: Call.Details) {
                super.onDetailsChanged(call, details)
                
                Log.d(TAG, "Call details changed: $callId")
                
                // Update might include disconnect cause
                details.disconnectCause?.let { cause ->
                    Log.d(TAG, "Disconnect cause: ${cause.code} - ${cause.description}")
                    CallManager.updateCallState(callId, call.state, cause)
                }
            }
            
            override fun onParentChanged(call: Call, parent: Call) {
                super.onParentChanged(call, parent)
                Log.d(TAG, "Call parent changed (conference): $callId")
            }
            
            override fun onChildrenChanged(call: Call, children: List<Call>) {
                super.onChildrenChanged(call, children)
                Log.d(TAG, "Call children changed (conference): $callId, children count: ${children.size}")
            }
            
            override fun onConferenceableCallsChanged(call: Call, conferenceableCalls: List<Call>) {
                super.onConferenceableCallsChanged(call, conferenceableCalls)
                Log.d(TAG, "Conferenceable calls changed: $callId")
            }
        }
    }

    
    /**
     * Send event to React Native via DialerModule
     */
    private fun sendEventToReactNative(eventType: String, callId: String) {
        try {
            val callInfo = CallManager.getCall(callId)
            if (callInfo == null) {
                Log.w(TAG, "Cannot send event - call not found: $callId")
                return
            }
            
            val dialerModule = getDialerModule()
            if (dialerModule != null) {
                dialerModule.sendCallEvent(
                    eventType = eventType,
                    callId = callInfo.callId,
                    state = CallManager.stateToString(callInfo.state),
                    phoneNumber = callInfo.phoneNumber,
                    callerName = callInfo.callerName,
                    direction = callInfo.direction.name.lowercase(),
                    disconnectCause = CallManager.disconnectCauseToString(callInfo.disconnectCause)
                )
                Log.d(TAG, "✓ Event sent to React Native: $eventType")
            } else {
                Log.w(TAG, "⚠️ DialerModule not available - React Native might not be ready")
                // This is normal when app is killed - UI will sync when it starts
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send event to React Native", e)
        }
    }
    
    /**
     * Get DialerModule from static instance reference
     * Works with React Native 0.83+ new architecture (ReactHost)
     * Returns null if React Native is not ready (e.g., app killed)
     */
    private fun getDialerModule(): com.albez0dialer.DialerModule? {
        return com.albez0dialer.DialerModule.instance
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // CallManager.CallStateListener implementation
    // ═══════════════════════════════════════════════════════════════════════
    
    override fun onCallAdded(callInfo: CallManager.CallInfo) {
        // Already handled in onCallAdded(Call) above
    }
    
    override fun onCallStateChanged(callInfo: CallManager.CallInfo) {
        Log.d(TAG, "CallManager notified state change: ${callInfo.callId}")
    }
    
    override fun onCallRemoved(callInfo: CallManager.CallInfo) {
        Log.d(TAG, "CallManager notified call removed: ${callInfo.callId}")
    }
}
