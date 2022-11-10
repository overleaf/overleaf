import { useTranslation } from 'react-i18next'
import { useContactUsModal } from '../../../shared/hooks/use-contact-us-modal'
import LeftMenuButton from './left-menu-button'

export default function HelpContactUs() {
  const { modal, showModal } = useContactUsModal()
  const { t } = useTranslation()

  return (
    <>
      <LeftMenuButton
        onClick={showModal}
        icon={{
          type: 'question',
          fw: true,
        }}
      >
        {t('contact_us')}
      </LeftMenuButton>
      {modal}
    </>
  )
}
