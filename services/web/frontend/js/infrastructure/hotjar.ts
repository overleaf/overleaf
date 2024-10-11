import getMeta from '@/utils/meta'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import { debugConsole } from '@/utils/debugging'
import { initializeHotjar } from '@/infrastructure/hotjar-snippet'

const { hotjarId, hotjarVersion } = getMeta('ol-ExposedSettings')

let hotjarInitialized = false

if (hotjarId && hotjarVersion && isSplitTestEnabled('hotjar')) {
  const loadHotjar = () => {
    // consent needed
    if (!document.cookie.split('; ').some(item => item === 'oa=1')) {
      return
    }

    if (!/^\d+$/.test(hotjarId) || !/^\d+$/.test(hotjarVersion)) {
      debugConsole.error('Invalid Hotjar id or version')
      return
    }

    // avoid inserting twice
    if (!hotjarInitialized) {
      debugConsole.log('Loading Hotjar')
      hotjarInitialized = true
      initializeHotjar(hotjarId, hotjarVersion)
    }
  }

  // load when idle, if supported
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(loadHotjar)
  } else {
    loadHotjar()
  }

  // listen for consent
  window.addEventListener('cookie-consent', event => {
    if ((event as CustomEvent<boolean>).detail) {
      loadHotjar()
    }
  })
}
