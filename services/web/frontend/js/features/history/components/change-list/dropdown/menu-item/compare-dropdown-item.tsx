import Icon from '../../../../../../shared/components/icon'
import { useHistoryContext } from '../../../../context/history-context'
import { UpdateRange } from '../../../../services/types/update'
import { ReactNode } from 'react'
import { Button, MenuItem } from 'react-bootstrap'

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
  icon = <Icon type="exchange" fw />,
  ...props
}: CompareProps) {
  const { setSelection } = useHistoryContext()

  const handleCompareVersion = (e: React.MouseEvent<Button>) => {
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
    <MenuItem {...props} onClick={handleCompareVersion}>
      {icon}
      <span className="">{text}</span>
    </MenuItem>
  )
}

export default CompareDropDownItem
