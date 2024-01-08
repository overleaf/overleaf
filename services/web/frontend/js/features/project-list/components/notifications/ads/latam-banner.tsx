import { useCallback, useEffect, useRef } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import usePersistedState from '../../../../../shared/hooks/use-persisted-state'
import Notification from '../notification'
import * as eventTracking from '../../../../../infrastructure/event-tracking'
import { Button } from 'react-bootstrap'
import getMeta from '../../../../../utils/meta'

const LATAM_CURRENCIES = {
  BRL: { name: 'Reais', discount: '50', flag: '🇧🇷' },
  MXN: { name: 'Pesos', discount: '40', flag: '🇲🇽' },
  COP: { name: 'Pesos', discount: '70', flag: '🇨🇴' },
  CLP: { name: 'Pesos', discount: '45', flag: '🇨🇱' },
  PEN: { name: 'Soles', discount: '50', flag: '🇵🇪' },
}

export default function LATAMBanner() {
  const { t } = useTranslation()
  const newNotificationStyle = getMeta(
    'ol-newNotificationStyle',
    false
  ) as boolean
  const [dismissedAt, setDismissedAt] = usePersistedState<Date | undefined>(
    `has_dismissed_latam_banner`
  )
  const viewEventSent = useRef<boolean>(false)

  useEffect(() => {
    if (!dismissedAt) {
      return
    }
    const dismissedAtDate = new Date(dismissedAt)
    const recentlyDismissedCutoff = new Date()
    recentlyDismissedCutoff.setDate(recentlyDismissedCutoff.getDate() - 30) // 30 days
    // once dismissedAt passes the cut-off mark, banner will be shown again
    if (dismissedAtDate <= recentlyDismissedCutoff) {
      setDismissedAt(undefined)
    }
  }, [dismissedAt, setDismissedAt])

  useEffect(() => {
    if (!dismissedAt && !viewEventSent.current) {
      eventTracking.sendMB('promo-prompt', {
        location: 'dashboard-banner',
        name: 'geo-pricing-latam',
        content: 'blue',
      })
      viewEventSent.current = true
    }
  }, [dismissedAt])

  const handleClick = useCallback(() => {
    eventTracking.sendMB('promo-click', {
      location: 'dashboard-banner',
      name: 'geo-pricing-latam',
      content: 'blue',
      type: 'click',
    })

    window.open('/user/subscription/plans')
  }, [])

  const handleDismiss = useCallback(() => {
    eventTracking.sendMB('promo-dismiss', {
      location: 'dashboard-banner',
      name: 'geo-pricing-latam',
      content: 'blue',
    })

    setDismissedAt(new Date())
  }, [setDismissedAt])

  if (dismissedAt) {
    return null
  }

  // Safety, but should always be a valid LATAM currency if ol-showLATAMBanner is true
  const currency = getMeta('ol-recommendedCurrency')
  if (!(currency in LATAM_CURRENCIES)) {
    return null
  }

  const {
    flag,
    name: currencyName,
    discount: discountPercent,
  } = LATAM_CURRENCIES[currency as keyof typeof LATAM_CURRENCIES]

  return (
    <Notification
      bsStyle="info"
      onDismiss={() => handleDismiss()}
      body={
        <Trans
          i18nKey="latam_discount_offer"
          components={[<b />]} // eslint-disable-line react/jsx-key
          values={{ flag, currencyName, discountPercent }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
        />
      }
      action={
        <Button
          bsStyle={newNotificationStyle ? null : 'info'}
          bsSize="sm"
          className={newNotificationStyle ? 'btn-secondary' : 'pull-right'}
          onClick={handleClick}
        >
          {t('get_discounted_plan')}
        </Button>
      }
    />
  )
}
