import { Capacitor } from '@capacitor/core'
import { supabase } from './supabaseClient'

// Push notifications for the Android app. On the website none of this runs.

let currentToken = null
let listening = false

function isNative() {
  return Capacitor.isNativePlatform()
}

// Ask permission, get this phone's push address and save it for the signed-in person.
export async function registerPush(userId) {
  if (!isNative() || !userId) return
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    if (!listening) {
      listening = true
      PushNotifications.addListener('registration', async ({ value }) => {
        currentToken = value
        const { data } = await supabase.auth.getSession()
        const uid = data?.session?.user?.id
        if (!uid) return
        await supabase
          .from('device_tokens')
          .upsert({ token: value, user_id: uid, platform: Capacitor.getPlatform(), updated_at: new Date().toISOString() }, { onConflict: 'token' })
      })

      // Tapping a notification opens the right page.
      PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
        const path = event?.notification?.data?.path
        window.location.hash = '#' + (path && path.startsWith('/') ? path : '/notifications')
      })
    }

    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions()
    }
    if (perm.receive !== 'granted') return
    await PushNotifications.register()
  } catch (err) {
    console.warn('Push setup failed', err)
  }
}

// Stop sending this phone notifications for the account that is signing out.
export async function unregisterPush() {
  if (!isNative() || !currentToken) return
  try {
    await supabase.from('device_tokens').delete().eq('token', currentToken)
  } catch {
    // ignore
  }
  currentToken = null
                                    }
