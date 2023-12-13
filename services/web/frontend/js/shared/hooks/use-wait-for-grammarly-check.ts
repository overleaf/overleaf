import { useEffect, useState } from 'react'

/**
 *
 * @param {number} delay how long to wait before checking for grammarly in ms
 * @param {boolean} initialState the initial state we should set grammarlyInstalled to before checking after the delay
 * @returns {boolean} a stateful boolean which is initially false, then updates to reflect whether grammarly is installed after the delay to check
 */
export default function useWaitForGrammarlyCheck({
  delay = 3000,
  initialState = false,
}) {
  const [grammarlyInstalled, setGrammarlyInstalled] = useState(() => {
    return initialState
  })

  useEffect(() => {
    const timer = setTimeout(
      () => setGrammarlyInstalled(grammarlyExtensionPresent()),
      delay
    )
    return () => clearTimeout(timer)
  }, [delay])
  return grammarlyInstalled
}

function grammarlyExtensionPresent() {
  return !!document.querySelector('grammarly-desktop-integration')
}
