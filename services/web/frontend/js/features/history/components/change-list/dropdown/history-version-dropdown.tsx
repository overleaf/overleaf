import ActionsDropdown from './actions-dropdown'
import AddLabel from './menu-item/add-label'
import Download from './menu-item/download'
import Compare from './menu-item/compare'
import { UpdateRange } from '../../../services/types/update'

type HistoryVersionDropdownProps = {
  id: string
  projectId: string
  isComparing: boolean
  isSelected: boolean
  updateMetaEndTimestamp: number
} & Pick<UpdateRange, 'fromV' | 'toV'>

function HistoryVersionDropdown({
  id,
  projectId,
  isComparing,
  isSelected,
  fromV,
  toV,
  updateMetaEndTimestamp,
}: HistoryVersionDropdownProps) {
  return (
    <ActionsDropdown id={id}>
      <AddLabel projectId={projectId} version={toV} />
      <Download projectId={projectId} version={toV} />
      {!isComparing && !isSelected && (
        <Compare
          projectId={projectId}
          fromV={fromV}
          toV={toV}
          updateMetaEndTimestamp={updateMetaEndTimestamp}
        />
      )}
    </ActionsDropdown>
  )
}

export default HistoryVersionDropdown
