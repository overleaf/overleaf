function bookmarkableTab(tabEl) {
  tabEl.addEventListener('click', () => {
    window.location.hash = tabEl.getAttribute('href')
  })
}

function handleHashChange() {
  const hash = window.location.hash
  if (!hash) return

  // Find the bookmarkable tab that links to the hash
  const $tabEl = $(`[data-ol-bookmarkable-tab][href="${hash}"]`)
  if (!$tabEl) return

  // Select the tab via Bootstrap
  $tabEl.tab('show')
}

document.querySelectorAll('[data-ol-bookmarkable-tab]').forEach(bookmarkableTab)
window.addEventListener('hashchange', handleHashChange)
handleHashChange()
