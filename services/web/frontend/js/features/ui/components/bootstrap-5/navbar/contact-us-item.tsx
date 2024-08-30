import NavDropdownLinkItem from '@/features/ui/components/bootstrap-5/navbar/nav-dropdown-link-item'
import { sendMB } from '@/infrastructure/event-tracking'
import { useTranslation } from 'react-i18next'

export default function ContactUsItem({
  showModal,
}: {
  showModal: (event?: Event) => void
}) {
  const { t } = useTranslation()

  return (
    <NavDropdownLinkItem
      href="#"
      onClick={() => {
        sendMB('menu-clicked-contact')
        showModal()
      }}
    >
      {t('contact_us')}
    </NavDropdownLinkItem>
  )
}
