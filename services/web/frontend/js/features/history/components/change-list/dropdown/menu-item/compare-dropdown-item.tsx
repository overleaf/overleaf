import { useHistoryContext } from '../../../../context/history-context'
import { UpdateRange } from '../../../../services/types/update'
import { ReactNode } from 'react'
import DropdownMenuItem from '@/shared/components/dropdown/dropdown-menu-item'

type CompareProps = {
  comparisonRange: UpdateRange
  icon: ReactNode
  text: string
  closeDropdown: () => void
}

function CompareDropDownItem({
  comparisonRange,
  text,
  closeDropdown,
  icon,
  ...props
}: CompareProps) {
  const { setSelection } = useHistoryContext()

  const handleCompareVersion = (e: React.MouseEvent) => {
    e.stopPropagation()
    closeDropdown()

    setSelection(({ previouslySelectedPathname }) => ({
      updateRange: comparisonRange,
      comparing: true,
      files: [],
      previouslySelectedPathname,
    }))
  }

  return (
    <DropdownMenuItem
      {...props}
      leadingIcon={icon}
      as="button"
      onClick={handleCompareVersion}
      className="dropdown-item-material-icon-small"
    >
      {text}
    </DropdownMenuItem>
  )
}

export default CompareDropDownItem
