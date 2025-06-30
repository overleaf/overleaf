import getMeta from '@/utils/meta'
import { debugConsole } from '@/utils/debugging'
import { initializeHotjar } from '@/infrastructure/hotjar-snippet'
import { createTrackingLoader } from '@/infrastructure/tracking-loader'

const { hotjarId, hotjarVersion } = getMeta('ol-ExposedSettings')
const shouldLoadHotjar = getMeta('ol-shouldLoadHotjar')

if (hotjarId && hotjarVersion && shouldLoadHotjar) {
  if (!/^\d+$/.test(hotjarId) || !/^\d+$/.test(hotjarVersion)) {
    debugConsole.error('Invalid Hotjar id or version')
  } else {
    createTrackingLoader(
      () => initializeHotjar(hotjarId, hotjarVersion),
      'Hotjar'
    )
  }
}
