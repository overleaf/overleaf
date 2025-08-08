import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { Dropdown } from 'react-bootstrap'
import MaterialIcon from '@/shared/components/material-icon'

export const SpellingSuggestionsLanguage = memo<{
  language: { name: string }
  handleClose: (focus: boolean) => void
}>(({ language, handleClose }) => {
  const { t } = useTranslation()

  const handleClick = useCallback(() => {
    // open the left menu
    window.dispatchEvent(
      new CustomEvent('ui.toggle-left-menu', { detail: true })
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
        <Dropdown.Item
          className="d-flex gap-2 align-items-center"
          onClick={handleClick}
        >
          <MaterialIcon type="settings" />
          <span>{language.name}</span>
        </Dropdown.Item>
      </span>
    </OLTooltip>
  )
})
SpellingSuggestionsLanguage.displayName = 'SpellingSuggestionsLanguage'
