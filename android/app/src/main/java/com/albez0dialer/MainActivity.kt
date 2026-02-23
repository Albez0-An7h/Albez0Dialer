package com.albez0dialer

import android.content.Intent
import android.os.Bundle
import android.util.Log
import com.albez0dialer.telecom.CallManager
import com.albez0dialer.telecom.CallNotificationManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  companion object {
      private const val TAG = "MainActivity"
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Albez0Dialer"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
      super.onCreate(savedInstanceState)
      handleIntent(intent)
  }

  override fun onNewIntent(intent: Intent) {
      super.onNewIntent(intent)
      setIntent(intent)
      handleIntent(intent)
  }

  /**
   * Handle incoming call and answer call intents from notifications
   * and from CallManager.launchIncomingCallUI()
   */
  private fun handleIntent(intent: Intent?) {
      if (intent == null) return

      when (intent.action) {
          "com.albez0dialer.INCOMING_CALL" -> {
              Log.d(TAG, "Received INCOMING_CALL intent")
              // The CallerScreen will be opened via CALL_STATE_CHANGED event listener in App.tsx
              // The event is sent by MyInCallService after this activity launches
          }
          "com.albez0dialer.ANSWER_CALL" -> {
              Log.d(TAG, "Received ANSWER_CALL intent from notification")
              // Answer the call immediately
              val callInfo = CallManager.getPrimaryCall()
              if (callInfo?.call != null) {
                  callInfo.call.answer(0)
                  Log.d(TAG, "Call answered from notification action")
              }
              CallNotificationManager.cancelNotification(this)
          }
          "com.albez0dialer.OPEN_ACTIVE_CALL" -> {
              Log.d(TAG, "Received OPEN_ACTIVE_CALL intent from ongoing notification")
              // App brought to foreground - CallerScreen will auto-open via AppState check in App.tsx
          }
      }
  }
}
