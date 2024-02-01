import Icon from '@/shared/components/icon'
import Tooltip from '@/shared/components/tooltip'
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
      <Icon
        type={isOpen ? 'angle-down' : 'angle-right'}
        className="outline-caret-icon"
      />
      <h4 className="outline-header-name">{t('file_outline')}</h4>
      {isPartial && (
        <Tooltip
          id="partial-outline"
          description={t('partial_outline_warning')}
          overlayProps={{ placement: 'top' }}
        >
          <span role="status">
            <Icon
              type="exclamation-triangle"
              aria-label={t('partial_outline_warning')}
            />
          </span>
        </Tooltip>
      )}
    </button>
  )
})
OutlineToggleButton.displayName = 'OutlineToggleButton'
