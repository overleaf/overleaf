function loadingFailed(imgEl) {
  return imgEl.complete && imgEl.naturalWidth === 0
}

document.querySelectorAll('[data-ol-fallback-image]').forEach(imgEl => {
  function showFallback() {
    imgEl.src = imgEl.getAttribute('data-ol-fallback-image')
  }
  if (loadingFailed(imgEl)) {
    // The image loading failed before the sprinkle ran.
    showFallback()
  } else {
    // The image loading might fail in the future.
    imgEl.addEventListener('error', showFallback)
  }
})
