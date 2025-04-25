if (typeof AbortSignal.timeout !== 'function') {
  AbortSignal.timeout = (time: number) => {
    const controller = new AbortController()

    function abort() {
      controller.abort(new DOMException('Timed out', 'TimeoutError'))
    }

    function clean() {
      window.clearTimeout(timer)
      controller.signal.removeEventListener('abort', clean)
    }

    controller.signal.addEventListener('abort', clean)

    const timer = window.setTimeout(abort, time)

    return controller.signal
  }
}

if (typeof AbortSignal.any !== 'function') {
  AbortSignal.any = (signals: AbortSignal[]) => {
    const controller = new AbortController()

    // return immediately if any of the signals are already aborted.
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort(signal.reason)
        return controller.signal
      }
    }

    function abort() {
      controller.abort()
      clean()
    }

    function clean() {
      for (const signal of signals) {
        signal.removeEventListener('abort', abort)
      }
    }

    // abort the controller (and clean up) when any of the signals aborts
    for (const signal of signals) {
      signal.addEventListener('abort', abort)
    }

    return controller.signal
  }
}

export default null // show that this is a module
