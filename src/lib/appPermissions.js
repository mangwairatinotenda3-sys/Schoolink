import { Capacitor } from '@capacitor/core'

// Phone permissions for the Android app. On the website none of this runs.

export function isNativeApp() {
  return Capacitor.isNativePlatform()
}

async function askMedia(constraints) {
  try {
    if (!navigator.mediaDevices?.getUserMedia) return false
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    stream.getTracks().forEach((t) => t.stop())
    return true
  } catch {
    return false
  }
}

export function requestMicrophone() {
  return askMedia({ audio: true })
}

export function requestCamera() {
  return askMedia({ video: true })
}

export async function requestNotifications() {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions()
    }
    return perm.receive === 'granted'
  } catch {
    return false
  }
}

const DONE_KEY = 'schoolink_permissions_done'

export function permissionsAlreadyAsked() {
  try {
    return localStorage.getItem(DONE_KEY) === '1'
  } catch {
    return true
  }
}

export function markPermissionsAsked() {
  try {
    localStorage.setItem(DONE_KEY, '1')
  } catch {
    // ignore
  }
}
