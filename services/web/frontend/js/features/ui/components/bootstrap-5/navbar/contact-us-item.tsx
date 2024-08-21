import NavDropdownLinkItem from '@/features/ui/components/bootstrap-5/navbar/nav-dropdown-link-item'
import { sendMB } from '@/infrastructure/event-tracking'
import { useTranslation } from 'react-i18next'
import { useContactUsModal } from '@/shared/hooks/use-contact-us-modal'
import { UserProvider } from '@/shared/context/user-context'

export default function ContactUsItem() {
  const { t } = useTranslation()
  const { modal, showModal } = useContactUsModal({ autofillProjectUrl: false })

  return (
    <>
      <NavDropdownLinkItem
        href="#"
        onClick={() => {
          sendMB('menu-clicked-contact')
          showModal()
        }}
      >
        {t('contact_us')}
      </NavDropdownLinkItem>
      <UserProvider>{modal}</UserProvider>
    </>
  )
}
