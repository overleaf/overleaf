import { memo, useCallback, useState } from 'react'
import Notification from './notification'
import customLocalStorage from '@/infrastructure/local-storage'
import OLButton from '@/features/ui/components/ol/ol-button'
import getMeta from '@/utils/meta'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import { useTranslation } from 'react-i18next'

function LabsAiPromoBanner() {
  const user = getMeta('ol-user')
  const cannotUseAi = getMeta('ol-cannot-use-ai')
  const { t } = useTranslation()

  const [show, setShow] = useState(() => {
    const dismissed = customLocalStorage.getItem(
      'has_dismissed_labs_ai_promo_banner'
    )
    if (dismissed || cannotUseAi) {
      return false
    }

    const show = user?.labsProgram === true && !user?.features?.aiErrorAssistant
    return show
  })

  const handleClose = useCallback(() => {
    eventTracking.sendMB('promo-dismiss', {
      name: 'labs-ai-experiment-promo',
    })
    customLocalStorage.setItem('has_dismissed_labs_ai_promo_banner', true)
    setShow(false)
  }, [setShow])

  const handleClick = useCallback(() => {
    eventTracking.sendMB('promo-click', {
      name: 'labs-ai-experiment-promo',
      content: 'try-now',
    })
    customLocalStorage.setItem('has_dismissed_labs_ai_promo_banner', true)
  }, [])

  if (!show) {
    return null
  }

  return (
    <div>
      <Notification
        type="info"
        onDismiss={handleClose}
        content={<span>{t('get_early_access_to_ai')}</span>}
        action={
          <OLButton
            variant="secondary"
            href="/labs/participate"
            onClick={handleClick}
          >
            {t('try_now')}
          </OLButton>
        }
      />
    </div>
  )
}

export default memo(LabsAiPromoBanner)
