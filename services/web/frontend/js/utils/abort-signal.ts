export const supportsModernAbortSignal =
  typeof AbortSignal.any === 'function' &&
  typeof AbortSignal.timeout === 'function'

export const signalWithTimeout = (signal: AbortSignal, timeout: number) => {
  if (supportsModernAbortSignal) {
    return AbortSignal.any([signal, AbortSignal.timeout(timeout)])
  }

  const abortController = new AbortController()

  const abort = () => {
    window.clearTimeout(timer)
    signal.removeEventListener('abort', abort)
    abortController.abort()
  }

  // abort after timeout has expired
  const timer = window.setTimeout(abort, timeout)

  // abort when the original signal is aborted
  signal.addEventListener('abort', abort)

  return abortController.signal
}
