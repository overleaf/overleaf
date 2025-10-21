import AddLabel from './menu-item/add-label'
import Download from './menu-item/download'
import { Version } from '../../../services/types/update'
import { useCallback } from 'react'
import { ActiveDropdown } from '../../../hooks/use-dropdown-active-item'
import RestoreProject from './menu-item/restore-project'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useHistoryContext } from '@/features/history/context/history-context'

type VersionDropdownContentProps = {
  projectId: string
  version: Version
  closeDropdownForItem: ActiveDropdown['closeDropdownForItem']
  endTimestamp: number
}

function HistoryDropdownContent({
  projectId,
  version,
  closeDropdownForItem,
  endTimestamp,
}: VersionDropdownContentProps) {
  const { updatesInfo } = useHistoryContext()
  const isCurrentVersion = version === updatesInfo.updates[0].toV

  const closeDropdown = useCallback(() => {
    closeDropdownForItem(version, 'moreOptions')
  }, [closeDropdownForItem, version])

  const permissions = usePermissionsContext()

  return (
    <>
      {permissions.labelVersion && (
        <AddLabel version={version} closeDropdown={closeDropdown} />
      )}
      <Download
        projectId={projectId}
        version={version}
        closeDropdown={closeDropdown}
      />
      {permissions.write && !isCurrentVersion && (
        <RestoreProject
          projectId={projectId}
          version={version}
          closeDropdown={closeDropdown}
          endTimestamp={endTimestamp}
        />
      )}
    </>
  )
}

export default HistoryDropdownContent
