import Download from './menu-item/download'
import { Version } from '../../../services/types/update'
import { ActiveDropdown } from '../../../hooks/use-dropdown-active-item'
import { useCallback } from 'react'

type LabelDropdownContentProps = {
  projectId: string
  version: Version
  closeDropdownForItem: ActiveDropdown['closeDropdownForItem']
}

function LabelDropdownContent({
  projectId,
  version,
  closeDropdownForItem,
}: LabelDropdownContentProps) {
  const closeDropdown = useCallback(() => {
    closeDropdownForItem(version, 'moreOptions')
  }, [closeDropdownForItem, version])

  return (
    <>
      <Download
        projectId={projectId}
        version={version}
        closeDropdown={closeDropdown}
      />
    </>
  )
}

export default LabelDropdownContent
