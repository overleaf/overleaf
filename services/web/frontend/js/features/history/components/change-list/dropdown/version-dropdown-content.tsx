import AddLabel from './menu-item/add-label'
import Download from './menu-item/download'
import { LoadedUpdate } from '../../../services/types/update'
import { useCallback } from 'react'
import { ActiveDropdown } from '../../../hooks/use-dropdown-active-item'
import CompareItems from './menu-item/compare-items'
import { updateRangeForUpdate } from '../../../utils/history-details'

type VersionDropdownContentProps = {
  projectId: string
  update: LoadedUpdate
  selected: boolean
  closeDropdownForItem: ActiveDropdown['closeDropdownForItem']
}

function VersionDropdownContent({
  projectId,
  update,
  selected,
  closeDropdownForItem,
}: VersionDropdownContentProps) {
  const updateRange = updateRangeForUpdate(update)

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
      <CompareItems
        updateRange={updateRange}
        selected={selected}
        closeDropdown={closeDropdown}
      />
    </>
  )
}

export default VersionDropdownContent
