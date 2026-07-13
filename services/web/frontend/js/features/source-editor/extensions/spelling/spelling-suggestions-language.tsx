import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { OLDropdownItem } from '@/shared/components/ol/ol-dropdown-menu'
import MaterialIcon from '@/shared/components/material-icon'

export const SpellingSuggestionsLanguage = memo<{
  language: { name: string }
  handleClose: (focus: boolean) => void
}>(({ language, handleClose }) => {
  const { t } = useTranslation()

  const handleClick = useCallback(() => {
    // open settings
    window.dispatchEvent(
      new CustomEvent('ui.toggle-settings', { detail: true })
    )
    // focus the spell check setting
    window.dispatchEvent(
      new CustomEvent('ui.focus-setting', { detail: 'spellCheckLanguage' })
    )
    handleClose(false)
  }, [handleClose])

  return (
    <OLTooltip
      id="spell-check-client-tooltip"
      description={t('change_language')}
      overlayProps={{ placement: 'right', delay: 100 }}
    >
      <span>
        <OLDropdownItem
          className="d-flex gap-2 align-items-center"
          onClick={handleClick}
        >
          <MaterialIcon type="settings" />
          <span>{language.name}</span>
        </OLDropdownItem>
      </span>
    </OLTooltip>
  )
})
SpellingSuggestionsLanguage.displayName = 'SpellingSuggestionsLanguage'
