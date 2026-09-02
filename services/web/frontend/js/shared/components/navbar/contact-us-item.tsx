import { useTranslation } from 'react-i18next'
import { OLDropdownItem } from '@/shared/components/ol/ol-dropdown-menu'
import DropdownListItem from '@/shared/components/dropdown/dropdown-list-item'
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
      <OLDropdownItem
        as="button"
        role="menuitem"
        onClick={() => {
          sendMB('menu-click', { item: 'contact', location })
          showModal()
        }}
      >
        {t('contact_us')}
      </OLDropdownItem>
    </DropdownListItem>
  )
}
