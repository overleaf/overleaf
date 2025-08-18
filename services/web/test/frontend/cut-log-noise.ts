/* eslint-disable no-console */
import { debugConsole } from '@/utils/debugging'

if (process.env.VERBOSE_LOGGING === 'true') {
  debugConsole.debug = console.debug
  debugConsole.log = console.log
} else {
  debugConsole.warn = () => {}
  debugConsole.error = () => {}
}

before(function () {
  // Range.getClientRects doesn't exist yet in jsdom
  window.Range.prototype.getClientRects = () => [] as any as DOMRectList
})
