import { memo, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'

export const OutlineItemToggleButton = memo<{
  expanded: boolean
  setExpanded: Dispatch<SetStateAction<boolean>>
}>(({ expanded, setExpanded }) => {
  const { t } = useTranslation()

  return (
    <button
      className="outline-item-expand-collapse-btn"
      onClick={() => setExpanded(value => !value)}
      aria-label={expanded ? t('collapse') : t('expand')}
    >
      <MaterialIcon
        type={expanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right'}
        className="outline-caret-icon"
      />
    </button>
  )
})
OutlineItemToggleButton.displayName = 'OutlineItemToggleButton'
