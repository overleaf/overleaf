import { MenuItem, MenuItemProps } from 'react-bootstrap'
import Icon from '../../../../../../shared/components/icon'
import { useHistoryContext } from '../../../../context/history-context'
import { UpdateRange } from '../../../../services/types/update'
import { ReactNode } from 'react'

type CompareProps = {
  comparisonRange: UpdateRange
  text: string
  icon?: ReactNode
  closeDropdown: () => void
}

function Compare({
  comparisonRange,
  text,
  closeDropdown,
  icon = <Icon type="exchange" fw />,
  ...props
}: CompareProps) {
  const { setSelection } = useHistoryContext()

  const handleCompareVersion = (e: React.MouseEvent<MenuItemProps>) => {
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
    <MenuItem onClick={handleCompareVersion} {...props}>
      {icon} {text}
    </MenuItem>
  )
}

export default Compare
