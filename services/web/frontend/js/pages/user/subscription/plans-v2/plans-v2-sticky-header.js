// we have different sticky header according to plans (individual, group, and student)
// we need to show different sticky header based on active tab
// the value of attribute 'data-ol-plans-v2-table-sticky-header' can be individual, group, or student
export function switchStickyHeader(viewTab) {
  document
    .querySelectorAll('[data-ol-plans-v2-table-sticky-header]')
    .forEach(el => {
      const plan = el.getAttribute('data-ol-plans-v2-table-sticky-header')

      if (plan === viewTab) {
        el.hidden = false
      } else {
        el.hidden = true
      }
    })
}

function stickyHeaderObserverCallback(entry) {
  const entryItem = entry[0]

  if (entryItem.boundingClientRect.bottom <= 0) {
    document
      .querySelectorAll('[data-ol-plans-v2-table-sticky-header]')
      .forEach(el => el.classList.remove('sticky'))
  } else {
    document
      .querySelectorAll('[data-ol-plans-v2-table-sticky-header]')
      .forEach(el => el.classList.add('sticky'))
  }
}

export function setUpStickyHeaderObserver() {
  const stickyHeaderStopEl = document.querySelector(
    '[data-ol-plans-v2-table-sticky-header-stop]'
  )

  const observer = new IntersectionObserver(stickyHeaderObserverCallback)

  observer.observe(stickyHeaderStopEl)
}
