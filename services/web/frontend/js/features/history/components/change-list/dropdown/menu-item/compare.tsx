import Icon from '../../../../../../shared/components/icon'
import { useHistoryContext } from '../../../../context/history-context'
import { UpdateRange } from '../../../../services/types/update'
import { ReactNode } from 'react'
import Tooltip from '../../../../../../shared/components/tooltip'
import { Button } from 'react-bootstrap'

type CompareProps = {
  comparisonRange: UpdateRange
  icon?: ReactNode
  toolTipDescription?: string
  closeDropdown: () => void
}

function Compare({
  comparisonRange,
  closeDropdown,
  toolTipDescription,
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
    <Tooltip
      description={toolTipDescription}
      id="compare-btn"
      overlayProps={{ placement: 'left' }}
    >
      <Button
        bsStyle={null}
        className="history-compare-btn"
        onClick={handleCompareVersion}
      >
        <span className="sr-only">{toolTipDescription}</span>
        {icon}
      </Button>
    </Tooltip>
  )
}

export default Compare
