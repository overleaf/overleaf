import { memo, type Dispatch, type SetStateAction } from 'react'
import Icon from '@/shared/components/icon'
import { useTranslation } from 'react-i18next'

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
      <Icon
        type={expanded ? 'angle-down' : 'angle-right'}
        className="outline-caret-icon"
      />
    </button>
  )
})
OutlineItemToggleButton.displayName = 'OutlineItemToggleButton'
