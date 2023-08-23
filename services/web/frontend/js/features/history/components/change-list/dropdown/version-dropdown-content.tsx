import AddLabel from './menu-item/add-label'
import Download from './menu-item/download'
import { LoadedUpdate } from '../../../services/types/update'
import { useCallback } from 'react'
import { ActiveDropdown } from '../../../hooks/use-dropdown-active-item'

type VersionDropdownContentProps = {
  projectId: string
  update: LoadedUpdate
  closeDropdownForItem: ActiveDropdown['closeDropdownForItem']
}

function VersionDropdownContent({
  projectId,
  update,
  closeDropdownForItem,
}: VersionDropdownContentProps) {
  const closeDropdown = useCallback(() => {
    closeDropdownForItem(update, 'moreOptions')
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
    </>
  )
}

export default VersionDropdownContent
