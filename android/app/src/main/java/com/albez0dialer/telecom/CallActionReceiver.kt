package com.albez0dialer.telecom

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * BroadcastReceiver to handle call actions from notifications
 * (e.g., "Decline" button on incoming call notification)
 */
class CallActionReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "CallActionReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            "com.albez0dialer.DECLINE_CALL" -> {
                val callId = intent.getStringExtra("callId")
                Log.d(TAG, "Decline action received for call: $callId")

                // Find the call and reject it
                val callInfo = if (callId != null) {
                    CallManager.getCall(callId)
                } else {
                    CallManager.getPrimaryCall()
                }

                callInfo?.call?.reject(false, null)
                    ?: Log.w(TAG, "No call found to decline")

                // Cancel notification
                CallNotificationManager.cancelNotification(context)
            }
            "com.albez0dialer.END_CALL" -> {
                val callId = intent.getStringExtra("callId")
                Log.d(TAG, "End call action received for call: $callId")

                val callInfo = if (callId != null) {
                    CallManager.getCall(callId)
                } else {
                    CallManager.getPrimaryCall()
                }

                callInfo?.call?.disconnect()
                    ?: Log.w(TAG, "No call found to end")

                // Cancel ongoing notification
                CallNotificationManager.cancelOngoingNotification(context)
            }
            else -> {
                Log.w(TAG, "Unknown action: ${intent.action}")
            }
        }
    }
}
