import OLTooltip from '@/shared/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'
import React, { memo } from 'react'
import { useTranslation } from 'react-i18next'

export const OutlineToggleButton = memo<{
  isTexFile: boolean
  toggleExpanded: () => void
  expanded?: boolean
  isOpen: boolean
  isPartial: boolean
}>(({ isTexFile, toggleExpanded, expanded, isOpen, isPartial }) => {
  const { t } = useTranslation()

  return (
    <button
      className="outline-header-expand-collapse-btn"
      disabled={!isTexFile}
      onClick={toggleExpanded}
      aria-label={expanded ? t('hide_outline') : t('show_outline')}
    >
      <MaterialIcon
        type={isOpen ? 'keyboard_arrow_down' : 'keyboard_arrow_right'}
        className="outline-caret-icon"
      />
      <h4 className="outline-header-name">{t('file_outline')}</h4>
      {isPartial && (
        <OLTooltip
          id="partial-outline"
          description={t('partial_outline_warning')}
          overlayProps={{ placement: 'top' }}
        >
          <span role="status" style={{ display: 'flex' }}>
            <MaterialIcon
              type="warning"
              accessibilityLabel={t('partial_outline_warning')}
            />
          </span>
        </OLTooltip>
      )}
    </button>
  )
})
OutlineToggleButton.displayName = 'OutlineToggleButton'
