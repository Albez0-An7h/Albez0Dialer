package com.albez0dialer.telecom

import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.telecom.Connection
import android.telecom.ConnectionRequest
import android.telecom.ConnectionService
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.telecom.DisconnectCause
import android.util.Log

/**
 * MyConnectionService - Handles SIM call connections via Android Telecom Framework
 * 
 * This service is the bridge between the Android telephony system and your app.
 * It manages both outgoing and incoming call connections.
 * 
 * Key responsibilities:
 * - Create Connection objects for outgoing calls
 * - Create Connection objects for incoming calls
 * - Manage call lifecycle (dialing, active, disconnected)
 * - Handle user actions (answer, reject, disconnect, hold)
 */
class MyConnectionService : ConnectionService() {

    companion object {
        private const val TAG = "MyConnectionService"
    }

    /**
     * Called when an outgoing call is being placed through this app
     * 
     * Flow: TelecomManager.placeCall() → This method
     * 
     * @param connectionManagerPhoneAccount The PhoneAccount that manages the connection
     * @param request Contains the phone number and call details
     * @return Connection object representing this call
     */
    override fun onCreateOutgoingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?
    ): Connection {
        Log.d(TAG, "onCreateOutgoingConnection: ${request?.address}")

        val connection = MyConnection()
        
        request?.let { req ->
            // Extract phone number from request
            val phoneNumber = req.address.schemeSpecificPart
            
            // Set connection properties
            connection.setAddress(req.address, TelecomManager.PRESENTATION_ALLOWED)
            connection.setCallerDisplayName(phoneNumber, TelecomManager.PRESENTATION_ALLOWED)
            
            // Set connection capabilities
            connection.connectionCapabilities = Connection.CAPABILITY_SUPPORT_HOLD or
                    Connection.CAPABILITY_HOLD or
                    Connection.CAPABILITY_MUTE
            
            // Set initial state to DIALING
            connection.setDialing()
            
            Log.d(TAG, "Outgoing connection created for: $phoneNumber")
            
            // The actual call will be handled by the telephony system
            // State transitions (DIALING -> ACTIVE) happen automatically
        }

        return connection
    }

    /**
     * Called when an incoming call is received through the system
     * 
     * Flow: System incoming call → This method
     * 
     * @param connectionManagerPhoneAccount The PhoneAccount managing the connection
     * @param request Contains caller information
     * @return Connection object representing this incoming call
     */
    override fun onCreateIncomingConnection(
        connectionManagerPhoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?
    ): Connection {
        Log.d(TAG, "onCreateIncomingConnection: ${request?.address}")

        val connection = MyConnection()
        
        request?.let { req ->
            // Extract caller phone number
            val phoneNumber = req.address.schemeSpecificPart
            
            // Set connection properties
            connection.setAddress(req.address, TelecomManager.PRESENTATION_ALLOWED)
            connection.setCallerDisplayName(phoneNumber, TelecomManager.PRESENTATION_ALLOWED)
            
            // Set connection capabilities
            connection.connectionCapabilities = Connection.CAPABILITY_SUPPORT_HOLD or
                    Connection.CAPABILITY_HOLD or
                    Connection.CAPABILITY_MUTE
            
            // Set initial state to RINGING
            connection.setRinging()
            
            Log.d(TAG, "Incoming connection created for: $phoneNumber")
        }

        return connection
    }

    /**
     * Custom Connection class that represents a single call
     * 
     * This class handles:
     * - Call state transitions
     * - User actions (answer, reject, disconnect)
     * - Audio state (mute, hold)
     */
    inner class MyConnection : Connection() {

        /**
         * Called when user answers an incoming call
         */
        override fun onAnswer() {
            Log.d(TAG, "onAnswer: User answered the call")
            setActive()
        }

        /**
         * Called when user rejects an incoming call
         */
        override fun onReject() {
            Log.d(TAG, "onReject: User rejected the call")
            setDisconnected(DisconnectCause(DisconnectCause.REJECTED))
            destroy()
        }

        /**
         * Called when user disconnects/ends the call
         */
        override fun onDisconnect() {
            Log.d(TAG, "onDisconnect: Call disconnected")
            setDisconnected(DisconnectCause(DisconnectCause.LOCAL))
            destroy()
        }

        /**
         * Called when user aborts an outgoing call before it connects
         */
        override fun onAbort() {
            Log.d(TAG, "onAbort: Outgoing call aborted")
            setDisconnected(DisconnectCause(DisconnectCause.CANCELED))
            destroy()
        }

        /**
         * Called when user puts call on hold
         */
        override fun onHold() {
            Log.d(TAG, "onHold: Call put on hold")
            setOnHold()
        }

        /**
         * Called when user resumes a held call
         */
        override fun onUnhold() {
            Log.d(TAG, "onUnhold: Call resumed from hold")
            setActive()
        }

        /**
         * Called when user toggles mute
         * 
         * @param state true = muted, false = unmuted
         */
        override fun onCallAudioStateChanged(state: android.telecom.CallAudioState?) {
            super.onCallAudioStateChanged(state)
            state?.let {
                Log.d(TAG, "Audio state changed - Mute: ${it.isMuted}, Route: ${it.route}")
            }
        }
    }
}
