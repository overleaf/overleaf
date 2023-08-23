import Icon from '../../../../../../shared/components/icon'
import { useHistoryContext } from '../../../../context/history-context'
import { UpdateRange } from '../../../../services/types/update'
import { ReactNode } from 'react'
import Tooltip from '../../../../../../shared/components/tooltip'
import { Button } from 'react-bootstrap'

type CompareProps = {
  comparisonRange: UpdateRange
  icon?: ReactNode
  text?: string
  toolTipDescription?: string
  closeDropdown: () => void
}

function Compare({
  comparisonRange,
  text,
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
        bsStyle="link"
        className="history-compare-btn"
        onClick={handleCompareVersion}
      >
        <span className="sr-only">{toolTipDescription}</span>
        {icon}
        {text ?? <span className="px-1">{text}</span>}
      </Button>
    </Tooltip>
  )
}

export default Compare
