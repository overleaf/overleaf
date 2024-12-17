import * as eventTracking from '../../infrastructure/event-tracking'
import { debugConsole } from '@/utils/debugging'

function setupEventTracking(el) {
  const key = el.getAttribute('event-tracking')
  const action = el.getAttribute('event-tracking-action') || key
  const label = el.getAttribute('event-tracking-label') || ''
  const gaCategory = el.getAttribute('event-tracking-ga')
  const sendMB = el.getAttribute('event-tracking-mb')
  const trigger = el.getAttribute('event-tracking-trigger')
  const sendOnce = el.getAttribute('event-tracking-send-once')
  const element = el.getAttribute('event-tracking-element')

  function submit() {
    if (key === 'menu-expand') {
      const expanded = el.getAttribute('aria-expanded')
      if (expanded === 'true') {
        // skip if the menu is already expanded
        return
      }
    }

    const segmentation = JSON.parse(
      el.getAttribute('event-segmentation') || '{}'
    )
    segmentation.page = window.location.pathname

    if (element === 'checkbox') {
      segmentation.checkbox = el.checked ? 'checked' : 'unchecked'
    } else if (element === 'select') {
      segmentation.selectValue = el.value
    }

    if (sendMB) {
      if (sendOnce) {
        eventTracking.sendMBOnce(key, segmentation)
      } else {
        eventTracking.sendMB(key, segmentation)
      }
    }
    if (gaCategory) {
      if (sendOnce) {
        eventTracking.sendOnce(gaCategory, action, label)
      } else {
        eventTracking.send(gaCategory, action, label)
      }
    }
  }

  let timer
  let timeoutAmt = 500
  switch (trigger) {
    case 'click':
      el.addEventListener('click', () => submit())
      break
    case 'hover':
      if (el.getAttribute('event-hover-amt')) {
        timeoutAmt = parseInt(el.getAttribute('event-hover-amt'), 10)
      }
      el.addEventListener('mouseenter', () => {
        timer = setTimeout(() => submit(), timeoutAmt)
      })
      el.addEventListener('mouseleave', () => clearTimeout(timer))
      break

    default:
      debugConsole.error(`unsupported event tracking action: ${trigger}`)
  }
}

document.querySelectorAll('[event-tracking]').forEach(setupEventTracking)
