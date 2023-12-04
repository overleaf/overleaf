import { useCallback, useEffect, useState } from 'react'
import MaterialIcon from '@/shared/components/material-icon'
import * as eventTracking from '../../../infrastructure/event-tracking'
import customLocalStorage from '../../../infrastructure/local-storage'
import grammarlyExtensionPresent from '../../../shared/utils/grammarly'
export default function GrammarlyAdvert() {
  const [show, setShow] = useState(false)

  // grammarly can take some time to load, and wont tell us when they do... so we need to run the check after a bit of time
  const [grammarlyInstalled, setGrammarlyInstalled] = useState(false)
  useEffect(() => {
    const timer = setTimeout(
      () => setGrammarlyInstalled(grammarlyExtensionPresent()),
      5000
    )
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const hasDismissedGrammarlyAdvert = customLocalStorage.getItem(
      'editor.has_dismissed_grammarly_advert'
    )
    // promotion ends on december 16th, 2023 at 00:00 UTC
    const promotionEnded =
      new Date() > new Date(Date.UTC(2023, 11, 16, 0, 0, 0))

    const showGrammarlyAdvert =
      grammarlyInstalled && !hasDismissedGrammarlyAdvert && !promotionEnded

    if (showGrammarlyAdvert) {
      eventTracking.sendMB('grammarly-advert-shown')
      setShow(true)
    }
  }, [grammarlyInstalled, setShow])

  const handleClose = useCallback(() => {
    setShow(false)
    customLocalStorage.setItem('editor.has_dismissed_grammarly_advert', true)
    eventTracking.sendMB('grammarly-advert-dismissed')
  }, [])

  if (!show) {
    return null
  }

  return (
    <div className="alert alert-info grammarly-advert" role="alert">
      <div className="grammarly-advert-container">
        <div className="advert-content">
          <p>
            Overleafers get a limited-time 30% discount on Grammarly Premium.
            (Hurry! Offer ends December 16.)
          </p>
          <a
            className="advert-link"
            onClick={() => eventTracking.sendMB('grammarly-advert-clicked')}
            href="https://www.grammarly.com/upgrade?transaction_id=10264119b53f745bed2cdca3c3e4a5&affiliateNetwork=ho&utm_campaign=Overleaf&affiliateID=142242&utm_source=program"
            target="_blank"
            rel="noopener"
          >
            Claim my discount
          </a>
        </div>
        <div className="grammarly-notification-close-btn">
          <button aria-label="Close" onClick={handleClose}>
            <MaterialIcon type="close" />
          </button>
        </div>
      </div>
    </div>
  )
}
