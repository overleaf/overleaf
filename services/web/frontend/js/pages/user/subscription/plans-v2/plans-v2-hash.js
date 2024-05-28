export function getViewInfoFromHash() {
  const hash = window.location.hash.substring(1)

  switch (hash) {
    case 'individual-monthly':
      return ['individual', 'monthly']
    case 'individual-annual':
      return ['individual', 'annual']
    case 'group':
      return ['group', 'annual']
    case 'student-monthly':
      return ['student', 'monthly']
    case 'student-annual':
      return ['student', 'annual']
    default:
      return ['individual', 'monthly']
  }
}

/**
 *
 * @param {individual | group | student} viewTab
 * @param {monthly | annual} period
 */
export function setHashFromViewTab(viewTab, period) {
  const newHash = viewTab === 'group' ? 'group' : `${viewTab}-${period}`
  if (window.location.hash.substring(1)) {
    window.location.hash = newHash
  }
}

// this is only for the students link in footer
export function handleForStudentsLinkInFooter() {
  const links = document.querySelectorAll('[data-ol-for-students-link]')

  links.forEach(function (link) {
    link.addEventListener('click', function () {
      if (window.location.pathname === '/user/subscription/plans') {
        // reload location with the correct hash
        const newURL =
          '/user/subscription/plans?itm_referrer=footer-for-students#student-annual'
        history.replaceState(null, '', newURL)
        location.reload()
      }
    })
  })
}
