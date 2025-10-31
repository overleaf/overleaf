import { debugConsole } from '@/utils/debugging'

let hasHandledAutoplayFailure = false

function enableControls(videoEl, reason) {
  debugConsole.log(`Enabling video controls: ${reason}`)
  videoEl.setAttribute('controls', '')
}

function setup(videoEl) {
  const reducedMotionReduce = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  )

  if (reducedMotionReduce.matches) {
    // TODO: on firefox, if user enters this mode, video can throw error
    // in console, if user seeks the control seek bar relatively fast
    // AbortError: The fetching process for the media resource was aborted by the user agent at the user's request.
    // this is only a problem in firefox (tested in macOS), chrome and safari is fine
    enableControls(videoEl, 'reduced motion preference')

    return
  }

  const DELAY_BEFORE_REPLAY = 15 * 1000
  // 0.7 will enable the autoplay on the desktop main homepage video for all users
  const INTERSECTION_THRESHOLD = 0.7

  let videoIsVisible

  function handleAutoplayFailure(error) {
    // Possible HTMLMediaElement.play() errors
    // Only show controls for errors where manual play would work
    // NotAllowedError: autoplay blocked by browser/device settings
    // AbortError: play attempt interrupted by browser
    if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
      if (!hasHandledAutoplayFailure) {
        hasHandledAutoplayFailure = true

        document.querySelectorAll('[data-ol-autoplay-video]').forEach(video => {
          enableControls(video, `autoplay blocked (${error.name})`)
        })
      }
    } else {
      debugConsole.error('Video playback error:', error)
    }
  }

  videoEl.addEventListener('ended', () => {
    setTimeout(() => {
      videoEl.currentTime = 0
      if (videoIsVisible && !hasHandledAutoplayFailure) {
        videoEl.play().catch(handleAutoplayFailure)
      }
    }, DELAY_BEFORE_REPLAY)
  })

  const observer = new IntersectionObserver(
    function onIntersecting(changes) {
      for (const change of changes) {
        if (change.isIntersecting) {
          videoIsVisible = true
          if (
            !hasHandledAutoplayFailure &&
            videoEl.readyState >= videoEl.HAVE_FUTURE_DATA
          ) {
            videoEl.play().catch(handleAutoplayFailure)
          }
        } else {
          videoIsVisible = false
          // Pause video when it leaves viewport to save resources
          if (!videoEl.paused) {
            videoEl.pause()
          }
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
