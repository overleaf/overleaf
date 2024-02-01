import { useEffect, useState } from 'react'

let titleIsFlashing = false
let originalTitle = ''
let flashIntervalHandle: ReturnType<typeof setInterval>

function flashTitle(message: string) {
  if (document.hasFocus() || titleIsFlashing) {
    return
  }

  function swapTitle() {
    if (window.document.title === originalTitle) {
      window.document.title = message
    } else {
      window.document.title = originalTitle
    }
  }

  originalTitle = window.document.title
  window.document.title = message
  titleIsFlashing = true
  flashIntervalHandle = setInterval(swapTitle, 800)
}

function stopFlashingTitle() {
  if (!titleIsFlashing) {
    return
  }

  clearInterval(flashIntervalHandle)
  window.document.title = originalTitle
  originalTitle = ''
  titleIsFlashing = false
}

function setTitle(title: string) {
  if (titleIsFlashing) {
    originalTitle = title
  } else {
    window.document.title = title
  }
}

function useBrowserWindow() {
  const [hasFocus, setHasFocus] = useState(() => document.hasFocus())

  useEffect(() => {
    function handleFocusEvent() {
      setHasFocus(true)
    }

    function handleBlurEvent() {
      setHasFocus(false)
    }

    window.addEventListener('focus', handleFocusEvent)
    window.addEventListener('blur', handleBlurEvent)
    return () => {
      window.removeEventListener('focus', handleFocusEvent)
      window.removeEventListener('blur', handleBlurEvent)
    }
  }, [])

  return { hasFocus, flashTitle, stopFlashingTitle, setTitle }
}

export default useBrowserWindow
