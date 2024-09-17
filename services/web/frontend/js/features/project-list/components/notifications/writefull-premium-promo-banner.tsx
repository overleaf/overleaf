import { memo, useCallback } from 'react'
import Notification from './notification'
import { sendMB } from '@/infrastructure/event-tracking'
import customLocalStorage from '@/infrastructure/local-storage'
import WritefullLogo from '@/shared/svgs/writefull-logo'
import OLButton from '@/features/ui/components/ol/ol-button'
import getMeta from '@/utils/meta'

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
  // dont show the add to WF commons users since their license already includes it
  const userAffiliations = getMeta('ol-userAffiliations') || []
  const hasWritefullCommons = userAffiliations.some(
    affil => affil.institution?.writefullCommonsAccount
  )
  const handleClose = useCallback(() => {
    customLocalStorage.setItem('has_dismissed_writefull_promo_banner', true)
    setShow(false)
    sendMB('promo-dismiss', eventSegmentation)
    onDismiss()
  }, [setShow, onDismiss])

  if (!show || hasWritefullCommons) {
    return null
  }

  return (
    <div data-testid="writefull-premium-promo-banner">
      <Notification
        type="info"
        onDismiss={handleClose}
        content={
          <>
            Enjoying Writefull? Get <strong>10% off Writefull Premium</strong>,
            giving you access to TeXGPT—AI assistance to generate LaTeX code.
            Use <strong>OVERLEAF10</strong> at the checkout.
          </>
        }
        action={
          <OLButton
            variant="secondary"
            href="https://my.writefull.com/overleaf-invite?code=OVERLEAF10&redirect=plans"
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              sendMB('promo-click', eventSegmentation)
            }}
          >
            <WritefullLogo width="16" height="16" />{' '}
            <span>Get Writefull Premium</span>
          </OLButton>
        }
      />
    </div>
  )
}

export default memo(WritefullPremiumPromoBanner)
