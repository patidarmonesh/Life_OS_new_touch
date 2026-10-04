import { registerSW } from 'virtual:pwa-register'
let waiting = false
export const hasWaitingUpdate = () => waiting
export const updateServiceWorker = registerSW({ immediate: true, onNeedRefresh() { waiting = true; window.dispatchEvent(new Event('lifeos-update-ready')) } })
