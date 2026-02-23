package com.albez0dialer.telecom

import android.content.Context
import android.content.Intent
import android.os.Build
import android.telecom.Call
import android.telecom.DisconnectCause
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

/**
 * CallManager - Singleton to manage call state across the application
 * 
 * This ensures call state is preserved even when:
 * - App process is killed
 * - React Native context is null
 * - Multiple components need access to call state
 * 
 * Acts as the single source of truth for call state
 */
object CallManager {
    private const val TAG = "CallManager"
    
    // Active calls map (supports multiple calls)
    private val activeCalls = mutableMapOf<String, CallInfo>()
    
    // Listeners for call state changes
    private val listeners = mutableSetOf<CallStateListener>()
    
    /**
     * Data class representing call information
     */
    data class CallInfo(
        val callId: String,
        val call: Call?,
        var state: Int,
        val phoneNumber: String,
        val callerName: String,
        val direction: CallDirection,
        var disconnectCause: DisconnectCause? = null,
        val timestamp: Long = System.currentTimeMillis()
    )
    
    enum class CallDirection {
        INCOMING,
        OUTGOING
    }
    
    enum class CallState {
        DIALING,
        RINGING,
        ACTIVE,
        HOLDING,
        DISCONNECTED,
        UNKNOWN
    }
    
    interface CallStateListener {
        fun onCallAdded(callInfo: CallInfo)
        fun onCallStateChanged(callInfo: CallInfo)
        fun onCallRemoved(callInfo: CallInfo)
    }
    
    /**
     * Add a new call to the manager
     */
    fun addCall(callId: String, call: Call, phoneNumber: String, callerName: String, direction: CallDirection) {
        Log.d(TAG, "addCall: $callId, number=$phoneNumber, direction=$direction")
        
        val callInfo = CallInfo(
            callId = callId,
            call = call,
            state = call.state,
            phoneNumber = phoneNumber,
            callerName = callerName,
            direction = direction
        )
        
        activeCalls[callId] = callInfo
        
        // Notify all listeners
        listeners.forEach { it.onCallAdded(callInfo) }
    }
    
    /**
     * Update call state
     */
    fun updateCallState(callId: String, newState: Int, disconnectCause: DisconnectCause? = null) {
        Log.d(TAG, "updateCallState: $callId, newState=$newState")
        
        activeCalls[callId]?.let { callInfo ->
            callInfo.state = newState
            callInfo.disconnectCause = disconnectCause
            
            // Notify all listeners
            listeners.forEach { it.onCallStateChanged(callInfo) }
        }
    }
    
    /**
     * Remove a call from the manager
     */
    fun removeCall(callId: String) {
        Log.d(TAG, "removeCall: $callId")
        
        activeCalls[callId]?.let { callInfo ->
            // Notify all listeners before removing
            listeners.forEach { it.onCallRemoved(callInfo) }
            
            activeCalls.remove(callId)
        }
    }
    
    /**
     * Get active call by ID
     */
    fun getCall(callId: String): CallInfo? {
        return activeCalls[callId]
    }
    
    /**
     * Get all active calls
     */
    fun getActiveCalls(): List<CallInfo> {
        return activeCalls.values.toList()
    }
    
    /**
     * Get primary active call (for single-call scenarios)
     */
    fun getPrimaryCall(): CallInfo? {
        // Return first active or holding call
        return activeCalls.values.firstOrNull { 
            it.state == Call.STATE_ACTIVE || it.state == Call.STATE_HOLDING 
        } ?: activeCalls.values.firstOrNull()
    }
    
    /**
     * Register a listener for call state changes
     */
    fun addListener(listener: CallStateListener) {
        listeners.add(listener)
    }
    
    /**
     * Unregister a listener
     */
    fun removeListener(listener: CallStateListener) {
        listeners.remove(listener)
    }
    
    /**
     * Convert Call state to string
     */
    fun stateToString(state: Int): String {
        return when (state) {
            Call.STATE_DIALING -> "outgoing"
            Call.STATE_RINGING -> "incoming"
            Call.STATE_ACTIVE -> "active"
            Call.STATE_HOLDING -> "holding"
            Call.STATE_DISCONNECTED -> "ended"
            else -> "unknown"
        }
    }
    
    /**
     * Convert DisconnectCause to readable string
     */
    fun disconnectCauseToString(cause: DisconnectCause?): String {
        return when (cause?.code) {
            DisconnectCause.LOCAL -> "local"
            DisconnectCause.REMOTE -> "remote"
            DisconnectCause.REJECTED -> "rejected"
            DisconnectCause.MISSED -> "missed"
            DisconnectCause.BUSY -> "busy"
            DisconnectCause.RESTRICTED -> "restricted"
            DisconnectCause.ERROR -> "error"
            DisconnectCause.CANCELED -> "canceled"
            DisconnectCause.UNKNOWN -> "unknown"
            DisconnectCause.OTHER -> "other"
            else -> "unknown"
        }
    }
    
    /**
     * Create WritableMap for React Native event
     */
    fun createEventMap(eventType: String, callInfo: CallInfo): WritableMap {
        return Arguments.createMap().apply {
            putString("type", eventType)
            putString("callId", callInfo.callId)
            putString("state", stateToString(callInfo.state))
            putString("phoneNumber", callInfo.phoneNumber)
            putString("callerName", callInfo.callerName)
            putString("direction", callInfo.direction.name.lowercase())
            callInfo.disconnectCause?.let {
                putString("disconnectCause", disconnectCauseToString(it))
                putString("disconnectMessage", it.description?.toString() ?: "")
            }
            putDouble("timestamp", callInfo.timestamp.toDouble())
        }
    }
    
    /**
     * Clear all calls (used when service is destroyed)
     */
    fun clearAll() {
        Log.d(TAG, "clearAll: Clearing ${activeCalls.size} calls")
        activeCalls.clear()
    }
    
    /**
     * Launch incoming call UI
     */
    fun launchIncomingCallUI(context: Context, callInfo: CallInfo) {
        Log.d(TAG, "launchIncomingCallUI: ${callInfo.phoneNumber}")
        
        try {
            val intent = Intent(context, com.albez0dialer.MainActivity::class.java).apply {
                action = "com.albez0dialer.INCOMING_CALL"
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or 
                       Intent.FLAG_ACTIVITY_CLEAR_TOP or
                       Intent.FLAG_ACTIVITY_SINGLE_TOP
                
                // Add call data to intent
                putExtra("callId", callInfo.callId)
                putExtra("phoneNumber", callInfo.phoneNumber)
                putExtra("callerName", callInfo.callerName)
                putExtra("callState", "incoming")
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                    addFlags(Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT)
                }
            }
            
            context.startActivity(intent)
            Log.d(TAG, "Successfully launched incoming call UI")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch incoming call UI", e)
        }
    }
}
