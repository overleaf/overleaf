import { GROUP_PLAN_MODAL_HASH } from '@/features/plans/group-plan-modal'

export function getViewInfoFromHash() {
  const hashValue = window.location.hash.replace('#', '')

  const groupPlanModalHashValue = GROUP_PLAN_MODAL_HASH.replace('#', '')

  switch (hashValue) {
    case 'individual-monthly':
      return ['individual', 'monthly']
    case 'individual-annual':
      return ['individual', 'annual']
    case groupPlanModalHashValue:
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
  if (window.location.hash.replace('#', '') !== newHash) {
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
