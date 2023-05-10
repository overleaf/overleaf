import { memo, useCallback, useState } from 'react'
import Notification from './notification'
import { sendMB } from '../../../../infrastructure/event-tracking'
import getMeta from '../../../../utils/meta'
import customLocalStorage from '../../../../infrastructure/local-storage'

const STORAGE_KEY = 'has_dismissed_writefull_promo_banner'

const eventSegmentation = {
  location: 'dashboard-banner',
  page: '/project',
  name: 'writefull',
}

const isChromium = () =>
  (window.navigator as any).userAgentData?.brands?.some(
    (item: { brand: string }) => item.brand === 'Chromium'
  )

function WritefullPromoBanner() {
  const [show, setShow] = useState(() => {
    const show =
      getMeta('ol-showWritefullPromoBanner') &&
      !customLocalStorage.getItem(STORAGE_KEY)

    if (show) {
      sendMB('promo-prompt', eventSegmentation)
    }

    return show
  })

  const handleOpenLink = useCallback(() => {
    sendMB('promo-click', eventSegmentation)
  }, [])

  const handleClose = useCallback(() => {
    customLocalStorage.setItem(STORAGE_KEY, new Date())
    setShow(false)
    sendMB('promo-dismiss', eventSegmentation)
  }, [])

  if (!show) {
    return null
  }

  if (!isChromium()) {
    return null
  }

  return (
    <Notification
      bsStyle="info"
      onDismiss={handleClose}
      className="centered-alert"
    >
      <Notification.Body>
        <span>
          Get <b>10% off</b> Writefull premium—AI-based language feedback and
          TeXGPT to help you write great papers faster. Use code:{' '}
          <b>OVERLEAF10</b>
        </span>
      </Notification.Body>
      <Notification.Action>
        <a
          className="pull-right btn btn-info btn-sm"
          href="https://my.writefull.com/overleaf-invite?code=OVERLEAF10"
          target="_blank"
          rel="noreferrer"
          onClick={handleOpenLink}
        >
          <img
            alt="Writefull Logo"
            src="data:image/png;base64,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"
            height={16}
            width={16}
            style={{ marginRight: 4 }}
          />
          <span>Get Writefull for Overleaf</span>
        </a>
      </Notification.Action>
    </Notification>
  )
}

export default memo(WritefullPromoBanner)
