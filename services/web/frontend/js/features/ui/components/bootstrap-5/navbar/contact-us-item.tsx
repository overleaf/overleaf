import { useTranslation } from 'react-i18next'
import { DropdownItem } from 'react-bootstrap-5'
import DropdownListItem from '@/features/ui/components/bootstrap-5/dropdown-list-item'
import {
  type ExtraSegmentations,
  useSendProjectListMB,
} from '@/features/project-list/components/project-list-events'

export default function ContactUsItem({
  showModal,
  location,
}: {
  showModal: (event?: Event) => void
  location: ExtraSegmentations['menu-click']['location']
}) {
  const { t } = useTranslation()
  const sendMB = useSendProjectListMB()

  return (
    <DropdownListItem>
      <DropdownItem
        as="button"
        role="menuitem"
        onClick={() => {
          sendMB('menu-click', { item: 'contact', location })
          showModal()
        }}
      >
        {t('contact_us')}
      </DropdownItem>
    </DropdownListItem>
  )
}
