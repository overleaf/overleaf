function stickyHeaderObserverCallback(entry) {
  document
    .querySelectorAll('[data-ol-plans-v2-table-sticky-header]')
    .forEach(el =>
      el.classList.toggle('sticky', entry[0].boundingClientRect.bottom > 0)
    )
}

export function setUpStickyHeaderObserver() {
  const stickyHeaderStopEl = document.querySelector(
    '[data-ol-plans-v2-table-sticky-header-stop]'
  )

  const observer = new IntersectionObserver(stickyHeaderObserverCallback)

  observer.observe(stickyHeaderStopEl)
}
