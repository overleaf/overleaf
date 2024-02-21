import { memo, useCallback } from 'react'
import Notification from './notification'
import { sendMB } from '@/infrastructure/event-tracking'
import customLocalStorage from '@/infrastructure/local-storage'
import WritefullLogo from '@/shared/svgs/writefull-logo'

const eventSegmentation = {
  location: 'dashboard-banner',
  page: '/project',
  name: 'writefull-premium',
}

function WritefullPremiumPromoBanner({
  show,
  setShow,
  onDismiss,
}: {
  show: boolean
  setShow: (value: boolean) => void
  onDismiss: () => void
}) {
  const handleClose = useCallback(() => {
    customLocalStorage.setItem('has_dismissed_writefull_promo_banner', true)
    setShow(false)
    sendMB('promo-dismiss', eventSegmentation)
    onDismiss()
  }, [setShow, onDismiss])

  if (!show) {
    return null
  }

  return (
    <Notification
      bsStyle="info"
      newNotificationStyle
      onDismiss={handleClose}
      body={
        <>
          Enjoying Writefull? Get <strong>10% off Writefull Premium</strong>,
          giving you access to TeXGPT—AI assistance to generate LaTeX code. Use{' '}
          <strong>OVERLEAF10</strong> at the checkout.
        </>
      }
      action={
        <a
          className="btn btn-secondary btn-sm"
          href="https://my.writefull.com/overleaf-invite?code=OVERLEAF10&redirect=plans"
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            sendMB('promo-click', eventSegmentation)
          }}
        >
          <WritefullLogo width="16" height="16" />{' '}
          <span>Get Writefull Premium</span>
        </a>
      }
    />
  )
}

export default memo(WritefullPremiumPromoBanner)
