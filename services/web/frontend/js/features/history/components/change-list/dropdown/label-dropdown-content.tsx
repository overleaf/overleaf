import Download from './menu-item/download'
import { Version } from '../../../services/types/update'
import { ActiveDropdown } from '../../../hooks/use-dropdown-active-item'
import { useCallback } from 'react'
import CompareItems from './menu-item/compare-items'

type LabelDropdownContentProps = {
  projectId: string
  version: Version
  versionTimestamp: number
  selected: boolean
  closeDropdownForItem: ActiveDropdown['closeDropdownForItem']
}

function LabelDropdownContent({
  projectId,
  version,
  versionTimestamp,
  selected,
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
      <CompareItems
        updateRange={{
          fromV: version,
          toV: version,
          fromVTimestamp: versionTimestamp,
          toVTimestamp: versionTimestamp,
        }}
        selected={selected}
        closeDropdown={closeDropdown}
      />
    </>
  )
}

export default LabelDropdownContent
