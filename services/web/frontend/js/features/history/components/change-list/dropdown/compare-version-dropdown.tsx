import ActionsDropdown from './actions-dropdown'
import MaterialIcon from '../../../../../shared/components/material-icon'
import { useTranslation } from 'react-i18next'

type CompareVersionDropdownProps = {
  children: React.ReactNode
  id: string
  isOpened: boolean
  setIsOpened: (isOpened: boolean) => void
}

function CompareVersionDropdown({
  children,
  id,
  isOpened,
  setIsOpened,
}: CompareVersionDropdownProps) {
  const { t } = useTranslation()
  return (
    <ActionsDropdown
      id={id}
      isOpened={isOpened}
      setIsOpened={setIsOpened}
      tooltipDescription={t('compare')}
      iconTag={
        <MaterialIcon
          type="align_space_even"
          className="history-dropdown-icon"
          accessibilityLabel={t('compare')}
        />
      }
    >
      {children}
    </ActionsDropdown>
  )
}

export default CompareVersionDropdown
