import AddLabel from './menu-item/add-label'
import Download from './menu-item/download'
import Compare from './menu-item/compare'
import { LoadedUpdate } from '../../../services/types/update'
import { useCallback } from 'react'
import { ActiveDropdown } from '../../../hooks/use-dropdown-active-item'

type VersionDropdownContentProps = {
  projectId: string
  update: LoadedUpdate
  selected: boolean
  comparing: boolean
  closeDropdownForItem: ActiveDropdown['closeDropdownForItem']
}

function VersionDropdownContent({
  projectId,
  update,
  selected,
  comparing,
  closeDropdownForItem,
}: VersionDropdownContentProps) {
  const closeDropdown = useCallback(() => {
    closeDropdownForItem(update)
  }, [closeDropdownForItem, update])

  return (
    <>
      <AddLabel
        projectId={projectId}
        version={update.toV}
        closeDropdown={closeDropdown}
      />
      <Download
        projectId={projectId}
        version={update.toV}
        closeDropdown={closeDropdown}
      />
      {!comparing && !selected && (
        <Compare
          projectId={projectId}
          fromV={update.fromV}
          toV={update.toV}
          updateMetaEndTimestamp={update.meta.end_ts}
          closeDropdown={closeDropdown}
        />
      )}
    </>
  )
}

export default VersionDropdownContent
