import getMeta from '@/utils/meta'
import { useTranslation } from 'react-i18next'
import { useRailContext } from '@/features/ide-react/context/rail-context'
import { useCallback } from 'react'
import {
  OLDropdownDivider,
  OLDropdownItem,
  OLDropdownMenu,
} from '@/shared/components/ol/ol-dropdown-menu'

export default function RailHelpDropdown() {
  const showSupport = getMeta('ol-showSupport')
  const showDocumentation = getMeta('ol-wikiEnabled')
  const { t } = useTranslation()
  const { setActiveModal } = useRailContext()
  const openKeyboardShortcutsModal = useCallback(() => {
    setActiveModal('keyboard-shortcuts')
  }, [setActiveModal])
  const openContactUsModal = useCallback(() => {
    setActiveModal('contact-us')
  }, [setActiveModal])

  return (
    <OLDropdownMenu>
      <OLDropdownItem onClick={openKeyboardShortcutsModal}>
        {t('keyboard_shortcuts')}
      </OLDropdownItem>
      {showDocumentation && (
        <OLDropdownItem
          href="/learn"
          role="menuitem"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('documentation')}
        </OLDropdownItem>
      )}
      {showSupport && (
        <>
          <OLDropdownDivider />
          <OLDropdownItem onClick={openContactUsModal}>
            {t('contact_us')}
          </OLDropdownItem>
        </>
      )}
    </OLDropdownMenu>
  )
}
