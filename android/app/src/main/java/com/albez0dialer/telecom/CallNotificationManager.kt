package com.albez0dialer.telecom

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.telecom.Call
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * CallNotificationManager - Handles call notifications
 * 
 * Shows a high-priority full-screen notification for incoming calls,
 * and an ongoing notification for active calls (so the call survives
 * when the app is in the background).
 */
object CallNotificationManager {

    private const val TAG = "CallNotificationMgr"
    private const val CHANNEL_ID = "incoming_call_channel"
    private const val CHANNEL_NAME = "Incoming Calls"
    private const val NOTIFICATION_ID = 9999

    private const val ONGOING_CHANNEL_ID = "ongoing_call_channel"
    private const val ONGOING_CHANNEL_NAME = "Ongoing Calls"
    private const val ONGOING_NOTIFICATION_ID = 9998

    private const val MISSED_CHANNEL_ID = "missed_call_channel"
    private const val MISSED_CHANNEL_NAME = "Missed Calls"
    private const val MISSED_NOTIFICATION_ID_BASE = 9900

    /**
     * Show a high-priority notification for an incoming call
     * with full-screen intent for lock screen / background
     */
    fun showIncomingCallNotification(context: Context, callInfo: CallManager.CallInfo) {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // Create notification channel (required for API 26+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Incoming phone call notifications"
                    setShowBadge(true)
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                    setBypassDnd(true)
                }
                notificationManager.createNotificationChannel(channel)
            }

            // Full-screen intent → opens MainActivity with incoming call data
            val fullScreenIntent = Intent(context, com.albez0dialer.MainActivity::class.java).apply {
                action = "com.albez0dialer.INCOMING_CALL"
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("callId", callInfo.callId)
                putExtra("phoneNumber", callInfo.phoneNumber)
                putExtra("callerName", callInfo.callerName)
                putExtra("callState", "incoming")
            }
            val fullScreenPendingIntent = PendingIntent.getActivity(
                context, 0, fullScreenIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // Answer action
            val answerIntent = Intent(context, com.albez0dialer.MainActivity::class.java).apply {
                action = "com.albez0dialer.ANSWER_CALL"
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("callId", callInfo.callId)
                putExtra("phoneNumber", callInfo.phoneNumber)
                putExtra("callerName", callInfo.callerName)
            }
            val answerPendingIntent = PendingIntent.getActivity(
                context, 1, answerIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // Decline action
            val declineIntent = Intent(context, CallActionReceiver::class.java).apply {
                action = "com.albez0dialer.DECLINE_CALL"
                putExtra("callId", callInfo.callId)
            }
            val declinePendingIntent = PendingIntent.getBroadcast(
                context, 2, declineIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val callerDisplay = if (callInfo.callerName != callInfo.phoneNumber && callInfo.callerName.isNotEmpty()) {
                callInfo.callerName
            } else {
                callInfo.phoneNumber
            }

            val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.sym_call_incoming)
                .setContentTitle("Incoming call")
                .setContentText(callerDisplay)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .setContentIntent(fullScreenPendingIntent)
                .addAction(android.R.drawable.sym_action_call, "Answer", answerPendingIntent)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", declinePendingIntent)
                .build()

            notificationManager.notify(NOTIFICATION_ID, notification)
            Log.d(TAG, "Incoming call notification shown for: $callerDisplay")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to show incoming call notification", e)
        }
    }

    /**
     * Show an ongoing notification for an active call.
     * Tapping it returns the user to the in-call screen.
     * Also shown when call is on hold (with "On Hold" status).
     */
    fun showOngoingCallNotification(context: Context, callInfo: CallManager.CallInfo) {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    ONGOING_CHANNEL_ID,
                    ONGOING_CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Ongoing phone call notifications"
                    setShowBadge(false)
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                }
                notificationManager.createNotificationChannel(channel)
            }

            // Tap → open app and return to call screen
            val contentIntent = Intent(context, com.albez0dialer.MainActivity::class.java).apply {
                action = "com.albez0dialer.OPEN_ACTIVE_CALL"
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("callId", callInfo.callId)
                putExtra("phoneNumber", callInfo.phoneNumber)
                putExtra("callerName", callInfo.callerName)
                putExtra("callState", "active")
            }
            val contentPendingIntent = PendingIntent.getActivity(
                context, 3, contentIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // End Call action
            val endCallIntent = Intent(context, CallActionReceiver::class.java).apply {
                action = "com.albez0dialer.END_CALL"
                putExtra("callId", callInfo.callId)
            }
            val endCallPendingIntent = PendingIntent.getBroadcast(
                context, 4, endCallIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val callerDisplay = if (callInfo.callerName != callInfo.phoneNumber && callInfo.callerName.isNotEmpty()) {
                callInfo.callerName
            } else {
                callInfo.phoneNumber
            }

            val isHolding = callInfo.state == Call.STATE_HOLDING
            val statusText = if (isHolding) "On Hold" else "Ongoing call"

            val notification = NotificationCompat.Builder(context, ONGOING_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_phone_call)
                .setContentTitle(callerDisplay)
                .setContentText(statusText)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setContentIntent(contentPendingIntent)
                .setUsesChronometer(!isHolding)
                .setWhen(callInfo.timestamp)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "End Call", endCallPendingIntent)
                .build()

            notificationManager.notify(ONGOING_NOTIFICATION_ID, notification)
            Log.d(TAG, "Ongoing call notification shown for: $callerDisplay (${if (isHolding) "holding" else "active"})")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to show ongoing call notification", e)
        }
    }

    /**
     * Show a notification for a missed call
     */
    fun showMissedCallNotification(context: Context, callInfo: CallManager.CallInfo) {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    MISSED_CHANNEL_ID,
                    MISSED_CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Missed phone call notifications"
                    setShowBadge(true)
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                }
                notificationManager.createNotificationChannel(channel)
            }

            val contentIntent = Intent(context, com.albez0dialer.MainActivity::class.java).apply {
                action = "com.albez0dialer.OPEN_RECENTS"
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            val contentPendingIntent = PendingIntent.getActivity(
                context, 10, contentIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val callBackIntent = Intent(context, com.albez0dialer.MainActivity::class.java).apply {
                action = "com.albez0dialer.CALL_BACK"
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("phoneNumber", callInfo.phoneNumber)
                putExtra("callerName", callInfo.callerName)
            }
            val callBackPendingIntent = PendingIntent.getActivity(
                context, 11, callBackIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val callerDisplay = if (callInfo.callerName != callInfo.phoneNumber && callInfo.callerName.isNotEmpty()) {
                callInfo.callerName
            } else {
                callInfo.phoneNumber
            }

            val notification = NotificationCompat.Builder(context, MISSED_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.sym_call_missed)
                .setContentTitle("Missed call")
                .setContentText(callerDisplay)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MISSED_CALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setContentIntent(contentPendingIntent)
                .addAction(android.R.drawable.sym_action_call, "Call back", callBackPendingIntent)
                .build()

            // Use a unique ID per caller so multiple missed calls show separate notifications
            val notificationId = MISSED_NOTIFICATION_ID_BASE + callInfo.phoneNumber.hashCode().mod(99)
            notificationManager.notify(notificationId, notification)
            Log.d(TAG, "Missed call notification shown for: $callerDisplay")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to show missed call notification", e)
        }
    }

    /**
     * Cancel the ongoing call notification
     */
    fun cancelOngoingNotification(context: Context) {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(ONGOING_NOTIFICATION_ID)
            Log.d(TAG, "Ongoing call notification cancelled")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to cancel ongoing notification", e)
        }
    }

    /**
     * Cancel the incoming call notification
     */
    fun cancelNotification(context: Context) {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(NOTIFICATION_ID)
            Log.d(TAG, "Incoming call notification cancelled")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to cancel notification", e)
        }
    }
}
