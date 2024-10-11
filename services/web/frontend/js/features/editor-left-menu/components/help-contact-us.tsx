import { useTranslation } from 'react-i18next'
import { useCallback } from 'react'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { useContactUsModal } from '../../../shared/hooks/use-contact-us-modal'
import LeftMenuButton from './left-menu-button'
import { bsVersionIcon } from '@/features/utils/bootstrap-5'

export default function HelpContactUs() {
  const { modal, showModal } = useContactUsModal()
  const { t } = useTranslation()

  const showModalWithAnalytics = useCallback(() => {
    eventTracking.sendMB('left-menu-contact')
    showModal()
  }, [showModal])

  return (
    <>
      <LeftMenuButton
        onClick={showModalWithAnalytics}
        icon={bsVersionIcon({
          bs5: { type: 'contact_support' },
          bs3: { type: 'question', fw: true },
        })}
      >
        {t('contact_us')}
      </LeftMenuButton>
      {modal}
    </>
  )
}
