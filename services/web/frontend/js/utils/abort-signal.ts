import './abortsignal-polyfill'

export const signalWithTimeout = (signal: AbortSignal, timeout: number) => {
  return AbortSignal.any([signal, AbortSignal.timeout(timeout)])
}
