import getMeta from '@/utils/meta'
import { debugConsole } from '@/utils/debugging'
import { initializeHotjar } from '@/infrastructure/hotjar-snippet'
import { createTrackingLoader } from '@/infrastructure/tracking-loader'
import grammarlyExtensionPresent from '@/shared/utils/grammarly'

const { hotjarId, hotjarVersion } = getMeta('ol-ExposedSettings')
const shouldLoadHotjar = getMeta('ol-shouldLoadHotjar')

function attemptHotjarLoad() {
  if (!hotjarId || !hotjarVersion) {
    return
  }

  if (!/^\d+$/.test(hotjarId) || !/^\d+$/.test(hotjarVersion)) {
    debugConsole.error('Invalid Hotjar id or version')
    return
  }

  if (grammarlyExtensionPresent()) {
    return
  }

  createTrackingLoader(
    () => initializeHotjar(hotjarId, hotjarVersion),
    'Hotjar'
  )
}

if (hotjarId && hotjarVersion && shouldLoadHotjar) {
  document.addEventListener('DOMContentLoaded', () => {
    // add delay to allow extensions to inject shadow DOM
    setTimeout(attemptHotjarLoad, 1000)
  })
}
