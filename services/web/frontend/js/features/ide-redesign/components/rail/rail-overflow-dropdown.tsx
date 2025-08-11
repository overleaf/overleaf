import { DropdownMenu } from '@/shared/components/dropdown/dropdown-menu'
import { RailTabKey } from '../../contexts/rail-context'
import { RailElement } from '../../utils/rail-types'
import RailTab from './rail-tab'

export default function RailOverflowDropdown({
  tabs,
  isOpen,
  selectedTab,
}: {
  tabs: RailElement[]
  isOpen: boolean
  selectedTab: RailTabKey
}) {
  return (
    <DropdownMenu className="ide-rail-overflow-dropdown">
      {tabs
        .filter(({ hide }) => !hide)
        .map(({ icon, key, indicator, title, disabled }) => (
          <RailTab
            open={isOpen && selectedTab === key}
            key={key}
            eventKey={key}
            icon={icon}
            indicator={indicator}
            title={title}
            disabled={disabled}
          />
        ))}
    </DropdownMenu>
  )
}
