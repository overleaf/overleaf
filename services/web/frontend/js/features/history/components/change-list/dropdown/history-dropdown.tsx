import ActionsDropdown from './actions-dropdown'
import Icon from '../../../../../shared/components/icon'
import { useTranslation } from 'react-i18next'

type HistoryDropdownProps = {
  children: React.ReactNode
  id: string
  isOpened: boolean
  setIsOpened: (isOpened: boolean) => void
}

function HistoryDropdown({
  children,
  id,
  isOpened,
  setIsOpened,
}: HistoryDropdownProps) {
  const { t } = useTranslation()
  return (
    <ActionsDropdown
      id={id}
      isOpened={isOpened}
      toolTipDescription={t('more_actions')}
      setIsOpened={setIsOpened}
      iconTag={
        <Icon type="ellipsis-v" accessibilityLabel={t('more_actions')} />
      }
      parentSelector="[data-history-version-list-container]"
    >
      {children}
    </ActionsDropdown>
  )
}

export default HistoryDropdown
