import { memo, useCallback } from 'react'
import Icon from '@/shared/components/icon'
import { useTranslation } from 'react-i18next'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'

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
      <button
        className="btn-link text-left dropdown-menu-button"
        onClick={handleClick}
      >
        <Icon type="cog" /> <span className="mx-1">{language.name}</span>
      </button>
    </OLTooltip>
  )
})
SpellingSuggestionsLanguage.displayName = 'SpellingSuggestionsLanguage'
