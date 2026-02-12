import getMeta from '@/utils/meta'
import { useTranslation } from 'react-i18next'
import { useRailContext } from '@/features/ide-react/context/rail-context'
import { useCallback } from 'react'
import {
  DropdownDivider,
  DropdownItem,
  DropdownMenu,
} from '@/shared/components/dropdown/dropdown-menu'

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
    <DropdownMenu>
      <DropdownItem onClick={openKeyboardShortcutsModal}>
        {t('keyboard_shortcuts')}
      </DropdownItem>
      {showDocumentation && (
        <DropdownItem
          href="/learn"
          role="menuitem"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('documentation')}
        </DropdownItem>
      )}
      {showSupport && (
        <>
          <DropdownDivider />
          <DropdownItem onClick={openContactUsModal}>
            {t('contact_us')}
          </DropdownItem>
        </>
      )}
    </DropdownMenu>
  )
}
