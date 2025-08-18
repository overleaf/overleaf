function loadingFailed(imgEl: HTMLImageElement) {
  return imgEl.complete && imgEl.naturalWidth === 0
}

document.querySelectorAll('[data-ol-fallback-image]').forEach(element => {
  if (!(element instanceof HTMLImageElement)) {
    // The sprinkle only applies to image elements.
    return
  }
  const imgEl = element as HTMLImageElement
  function showFallback() {
    imgEl.src = imgEl.getAttribute('data-ol-fallback-image')!
  }
  if (loadingFailed(imgEl)) {
    // The image loading failed before the sprinkle ran.
    showFallback()
  } else {
    // The image loading might fail in the future.
    imgEl.addEventListener('error', showFallback)
  }
})
