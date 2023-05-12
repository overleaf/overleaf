import ActionsDropdown from './actions-dropdown'
import Download from './menu-item/download'
import Compare from './menu-item/compare'

type LabelDropdownProps = {
  id: string
  projectId: string
  isComparing: boolean
  isSelected: boolean
  version: number
  updateMetaEndTimestamp: number
}

function LabelDropdown({
  id,
  projectId,
  isComparing,
  isSelected,
  version,
  updateMetaEndTimestamp,
}: LabelDropdownProps) {
  return (
    <ActionsDropdown
      id={id}
      parentSelector="[data-history-version-list-container]"
    >
      <Download projectId={projectId} version={version} />
      {!isComparing && !isSelected && (
        <Compare
          projectId={projectId}
          fromV={version}
          toV={version}
          updateMetaEndTimestamp={updateMetaEndTimestamp}
        />
      )}
    </ActionsDropdown>
  )
}

export default LabelDropdown
