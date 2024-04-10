import AddLabel from './menu-item/add-label'
import Download from './menu-item/download'
import { Version } from '../../../services/types/update'
import { useCallback } from 'react'
import { ActiveDropdown } from '../../../hooks/use-dropdown-active-item'

type VersionDropdownContentProps = {
  projectId: string
  version: Version
  closeDropdownForItem: ActiveDropdown['closeDropdownForItem']
}

function HistoryDropdownContent({
  projectId,
  version,
  closeDropdownForItem,
}: VersionDropdownContentProps) {
  const closeDropdown = useCallback(() => {
    closeDropdownForItem(version, 'moreOptions')
  }, [closeDropdownForItem, version])

  return (
    <>
      <AddLabel
        projectId={projectId}
        version={version}
        closeDropdown={closeDropdown}
      />
      <Download
        projectId={projectId}
        version={version}
        closeDropdown={closeDropdown}
      />
    </>
  )
}

export default HistoryDropdownContent
