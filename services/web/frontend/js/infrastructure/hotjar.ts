import getMeta from '@/utils/meta'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import { debugConsole } from '@/utils/debugging'

const { hotjarId, hotjarVersion } = getMeta('ol-ExposedSettings')

if (hotjarId && hotjarVersion && isSplitTestEnabled('hotjar')) {
  const loadHotjar = () => {
    // consent needed
    if (!document.cookie.split('; ').some(item => item === 'oa=1')) {
      return
    }

    // avoid inserting twice
    if (document.getElementById('hotjar')) {
      return
    }

    debugConsole.log('Loading Hotjar')

    const url = new URL(`https://static.hotjar.com/c/hotjar-${hotjarId}.js`)
    url.searchParams.set('sv', hotjarVersion)

    const script = document.createElement('script')
    script.src = url.toString()
    script.async = true
    script.id = 'hotjar'

    document.head.append(script)
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
