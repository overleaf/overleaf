import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dropdown } from 'react-bootstrap'
import DropdownToggleWithTooltip from '../../../../../shared/components/dropdown/dropdown-toggle-with-tooltip'
import Icon from '../../../../../shared/components/icon'

type DropdownMenuProps = {
  id: string
  children: React.ReactNode
}

function ActionsDropdown({ id, children }: DropdownMenuProps) {
  const { t } = useTranslation()
  const [isOpened, setIsOpened] = useState(false)

  return (
    <>
      <Dropdown
        id={`history-version-dropdown-${id}`}
        pullRight
        open={isOpened}
        onToggle={open => setIsOpened(open)}
      >
        <DropdownToggleWithTooltip
          bsRole="toggle"
          className="history-version-dropdown-menu-btn"
          tooltipProps={{
            id,
            description: t('more_actions'),
            overlayProps: { placement: 'bottom', trigger: ['hover'] },
          }}
        >
          <Icon type="ellipsis-v" accessibilityLabel={t('more_actions')} />
        </DropdownToggleWithTooltip>
        <Dropdown.Menu className="history-version-dropdown-menu">
          {children}
        </Dropdown.Menu>
      </Dropdown>
    </>
  )
}

export default ActionsDropdown
