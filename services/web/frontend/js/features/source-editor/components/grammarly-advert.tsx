import { useCallback, useEffect, useState } from 'react'
import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import Notification from '@/shared/components/notification'
import useRemindMeLater from '@/shared/hooks/use-remind-me-later'
import GrammarlyLogo from '@/shared/svgs/grammarly-logo'
import * as eventTracking from '../../../infrastructure/event-tracking'
import useWaitForGrammarlyCheck from '@/shared/hooks/use-wait-for-grammarly-check'

export default function GrammarlyAdvert() {
  const [show, setShow] = useState(false)
  const { t } = useTranslation()

  // grammarly can take some time to load, we should assume its installed and hide until we know for sure
  const grammarlyInstalled = useWaitForGrammarlyCheck({ initialState: false })

  const { stillDissmissed, remindThemLater, saveDismissed } =
    useRemindMeLater('grammarly_advert')

  useEffect(() => {
    const showGrammarlyAdvert = grammarlyInstalled && !stillDissmissed

    if (showGrammarlyAdvert) {
      eventTracking.sendMB('grammarly-advert-shown')
      setShow(true)
    }
  }, [stillDissmissed, grammarlyInstalled, setShow])

  const handleDismiss = useCallback(() => {
    setShow(false)
    saveDismissed()
    eventTracking.sendMB('grammarly-advert-dismissed')
  }, [saveDismissed])

  const handleClickClaim = useCallback(() => {
    eventTracking.sendMB('promo-click', {
      location: 'notification',
      name: 'grammarly-advert',
      type: 'click',
    })

    saveDismissed()
    setShow(false)

    window.open(
      'https://grammarly.go2cloud.org/aff_c?offer_id=373&aff_id=142242'
    )
  }, [saveDismissed])

  const handleLater = useCallback(() => {
    eventTracking.sendMB('promo-click', {
      location: 'notification',
      name: 'grammarly-advert',
      type: 'pause',
    })
    setShow(false)
    remindThemLater()
  }, [remindThemLater])

  if (!show) {
    return null
  }

  const actions = (
    <div>
      <Button
        bsStyle={null}
        className="btn-secondary"
        onClick={handleClickClaim}
      >
        {t('claim_discount')}
      </Button>
      <Button className="btn-bg-ghost" bsStyle={null} onClick={handleLater}>
        {t('maybe_later')}
      </Button>
    </div>
  )

  return (
    <Notification
      action={actions}
      ariaLive="polite"
      className="editor-notification ol-overlay"
      content={
        <div>
          <p>
            Get 25% off Grammarly Premium with this exclusive offer for Overleaf
            users.
          </p>
        </div>
      }
      customIcon={
        <div>
          <GrammarlyLogo width="50" height="50" background="#fff" />
        </div>
      }
      isActionBelowContent
      isDismissible
      onDismiss={handleDismiss}
      title="Love Grammarly? Then you're in luck!"
      type="offer"
    />
  )
}
