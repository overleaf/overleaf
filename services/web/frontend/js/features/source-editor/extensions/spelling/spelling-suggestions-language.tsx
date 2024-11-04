import { memo, useCallback } from 'react'
import Icon from '@/shared/components/icon'
import { useTranslation } from 'react-i18next'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import { bsVersion, isBootstrap5 } from '@/features/utils/bootstrap-5'
import { Dropdown } from 'react-bootstrap-5'
import PolymorphicComponent from '@/shared/components/polymorphic-component'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
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
        <PolymorphicComponent
          as={isBootstrap5() ? Dropdown.Item : 'a'}
          className={bsVersion({
            bs3: 'btn-link text-left dropdown-menu-button',
            bs5: 'd-flex gap-2 align-items-center',
          })}
          onClick={handleClick}
        >
          <BootstrapVersionSwitcher
            bs3={<Icon type="cog" />}
            bs5={<MaterialIcon type="settings" />}
          />
          <span className={bsVersion({ bs3: 'ms-1' })}>{language.name}</span>
        </PolymorphicComponent>
      </span>
    </OLTooltip>
  )
})
SpellingSuggestionsLanguage.displayName = 'SpellingSuggestionsLanguage'
