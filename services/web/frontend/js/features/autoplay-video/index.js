function setup(videoEl) {
  const reducedMotionReduce = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  )

  if (reducedMotionReduce.matches) {
    // TODO: on firefox, if user enters this mode, video can throw error
    // in console, if user seeks the control seek bar relatively fast
    // AbortError: The fetching process for the media resource was aborted by the user agent at the user's request.
    // this is only a problem in firefox (tested in macOS), chrome and safari is fine
    videoEl.setAttribute('controls', '')

    return
  }

  const DELAY_BEFORE_REPLAY = 15 * 1000
  // 0.7 will enable the autoplay on the desktop main homepage video for all users
  const INTERSECTION_THRESHOLD = 0.7

  let videoIsVisible

  videoEl.addEventListener('ended', () => {
    setTimeout(() => {
      videoEl.currentTime = 0
      if (videoIsVisible) {
        videoEl.play()
      }
    }, DELAY_BEFORE_REPLAY)
  })

  const observer = new IntersectionObserver(
    function onIntersecting(changes) {
      for (const change of changes) {
        if (change.isIntersecting) {
          videoIsVisible = true
          if (videoEl.readyState >= videoEl.HAVE_FUTURE_DATA) {
            if (!videoEl.ended) {
              videoEl.play()
            }
          } else {
            videoEl.play()
          }
        } else {
          videoIsVisible = false
        }
      }
    },
    {
      threshold: INTERSECTION_THRESHOLD,
    }
  )

  observer.observe(videoEl)
}

document.querySelectorAll('[data-ol-autoplay-video]').forEach(setup)
