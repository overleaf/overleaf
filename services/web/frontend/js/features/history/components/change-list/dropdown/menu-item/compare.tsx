import { useHistoryContext } from '../../../../context/history-context'
import { UpdateRange } from '../../../../services/types/update'
import { ReactNode } from 'react'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import { bsVersion } from '@/features/utils/bootstrap-5'

type CompareProps = {
  comparisonRange: UpdateRange
  icon: ReactNode
  toolTipDescription?: string
  closeDropdown: () => void
}

function Compare({
  comparisonRange,
  closeDropdown,
  toolTipDescription,
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
      description={toolTipDescription}
      id="compare-btn"
      overlayProps={{ placement: 'left' }}
    >
      <button className="history-compare-btn" onClick={handleCompareVersion}>
        <span className={bsVersion({ bs3: 'sr-only', bs5: 'visually-hidden' })}>
          {toolTipDescription}
        </span>
        {icon}
      </button>
    </OLTooltip>
  )
}

export default Compare
