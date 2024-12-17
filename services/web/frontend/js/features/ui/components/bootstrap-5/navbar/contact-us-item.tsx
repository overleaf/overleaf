import { sendMB } from '@/infrastructure/event-tracking'
import { useTranslation } from 'react-i18next'
import { DropdownItem } from 'react-bootstrap-5'
import DropdownListItem from '@/features/ui/components/bootstrap-5/dropdown-list-item'

export default function ContactUsItem({
  showModal,
}: {
  showModal: (event?: Event) => void
}) {
  const { t } = useTranslation()

  return (
    <DropdownListItem>
      <DropdownItem
        as="button"
        role="menuitem"
        onClick={() => {
          sendMB('menu-clicked-contact')
          showModal()
        }}
      >
        {t('contact_us')}
      </DropdownItem>
    </DropdownListItem>
  )
}
