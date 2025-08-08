import { useHistoryContext } from '../../../../context/history-context'
import { UpdateRange } from '../../../../services/types/update'
import { ReactNode } from 'react'
import OLTooltip from '@/shared/components/ol/ol-tooltip'

type CompareProps = {
  comparisonRange: UpdateRange
  icon: ReactNode
  tooltipDescription?: string
  closeDropdown: () => void
}

function Compare({
  comparisonRange,
  closeDropdown,
  tooltipDescription,
  icon,
}: CompareProps) {
  const { setSelection } = useHistoryContext()

  const handleCompareVersion = (e: { stopPropagation: () => void }) => {
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
    <OLTooltip
      description={tooltipDescription}
      id="compare-btn"
      overlayProps={{ placement: 'left' }}
    >
      <button className="history-compare-btn" onClick={handleCompareVersion}>
        <span className="visually-hidden">{tooltipDescription}</span>
        {icon}
      </button>
    </OLTooltip>
  )
}

export default Compare
