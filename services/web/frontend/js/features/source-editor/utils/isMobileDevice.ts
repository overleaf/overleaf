import browser from '../extensions/browser'

export function isMobileDevice(): boolean {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isMobileUserAgent = /Android|iPhone|iPad|Mobile/i.test(ua)

  // Input-capability fallback.
  const isTouchOnlyInput =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches &&
    window.matchMedia('(hover: none)').matches

  return browser.ios || browser.android || isMobileUserAgent || isTouchOnlyInput
}
