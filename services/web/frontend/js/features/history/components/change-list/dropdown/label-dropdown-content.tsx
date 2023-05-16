import Download from './menu-item/download'
import Compare from './menu-item/compare'
import { Version } from '../../../services/types/update'
import { ActiveDropdown } from '../../../hooks/use-dropdown-active-item'
import { useCallback } from 'react'

type LabelDropdownContentProps = {
  projectId: string
  version: Version
  updateMetaEndTimestamp: number
  selected: boolean
  comparing: boolean
  closeDropdownForItem: ActiveDropdown['closeDropdownForItem']
}

function LabelDropdownContent({
  projectId,
  version,
  updateMetaEndTimestamp,
  selected,
  comparing,
  closeDropdownForItem,
}: LabelDropdownContentProps) {
  const closeDropdown = useCallback(() => {
    closeDropdownForItem(version)
  }, [closeDropdownForItem, version])

  return (
    <>
      <Download
        projectId={projectId}
        version={version}
        closeDropdown={closeDropdown}
      />
      {!comparing && !selected && (
        <Compare
          projectId={projectId}
          fromV={version}
          toV={version}
          updateMetaEndTimestamp={updateMetaEndTimestamp}
          closeDropdown={closeDropdown}
        />
      )}
    </>
  )
}

export default LabelDropdownContent
