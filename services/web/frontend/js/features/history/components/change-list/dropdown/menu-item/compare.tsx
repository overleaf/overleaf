import { MenuItem, MenuItemProps } from 'react-bootstrap'
import Icon from '../../../../../../shared/components/icon'
import { useHistoryContext } from '../../../../context/history-context'
import { UpdateRange } from '../../../../services/types/update'

type CompareProps = {
  comparisonRange: UpdateRange
  text: string
  closeDropdown: () => void
}

function Compare({
  comparisonRange,
  text,
  closeDropdown,
  ...props
}: CompareProps) {
  const { setSelection } = useHistoryContext()

  const handleCompareVersion = (e: React.MouseEvent<MenuItemProps>) => {
    e.stopPropagation()
    closeDropdown()

    setSelection({
      updateRange: comparisonRange,
      comparing: true,
      files: [],
    })
  }

  return (
    <MenuItem onClick={handleCompareVersion} {...props}>
      <Icon type="exchange" fw /> {text}
    </MenuItem>
  )
}

export default Compare
