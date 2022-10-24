import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ContactUsModal from '../../../../../modules/support/frontend/js/components/contact-us-modal'
import LeftMenuButton from './left-menu-button'

export default function HelpContactUs() {
  const [showModal, setShowModal] = useState(false)
  const { t } = useTranslation()

  return (
    <>
      <LeftMenuButton
        onClick={() => setShowModal(true)}
        icon={{
          type: 'question',
          fw: true,
        }}
      >
        {t('contact_us')}
      </LeftMenuButton>
      <ContactUsModal show={showModal} handleHide={() => setShowModal(false)} />
    </>
  )
}
