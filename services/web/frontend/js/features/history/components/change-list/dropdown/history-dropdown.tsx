import ActionsDropdown from './actions-dropdown'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'

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
      tooltipDescription={t('more_actions')}
      setIsOpened={setIsOpened}
      iconTag={
        <MaterialIcon type="more_vert" accessibilityLabel={t('more_actions')} />
      }
    >
      {children}
    </ActionsDropdown>
  )
}

export default HistoryDropdown
