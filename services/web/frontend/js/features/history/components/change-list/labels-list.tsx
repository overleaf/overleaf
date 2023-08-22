import { useUserContext } from '../../../../shared/context/user-context'
import { isVersionSelected } from '../../utils/history-details'
import { useMemo } from 'react'
import LabelListItem from './label-list-item'
import useDropdownActiveItem from '../../hooks/use-dropdown-active-item'
import { getVersionWithLabels } from '../../utils/label'
import { useHistoryContext } from '../../context/history-context'

function LabelsList() {
  const { id: currentUserId } = useUserContext()
  const { projectId, labels, selection, setSelection } = useHistoryContext()
  const { activeDropdownItem, setActiveDropdownItem, closeDropdownForItem } =
    useDropdownActiveItem()

  const versionWithLabels = useMemo(
    () => getVersionWithLabels(labels),
    [labels]
  )

  return (
    <>
      {versionWithLabels.map(({ version, labels }) => {
        const selected = isVersionSelected(selection, version)
        const dropdownActive = version === activeDropdownItem.item

        return (
          <LabelListItem
            key={version}
            labels={labels}
            version={version}
            currentUserId={currentUserId}
            projectId={projectId}
            selected={selected}
            selectable={selected !== 'selected'}
            setSelection={setSelection}
            dropdownOpen={activeDropdownItem.isOpened && dropdownActive}
            dropdownActive={dropdownActive}
            setActiveDropdownItem={setActiveDropdownItem}
            closeDropdownForItem={closeDropdownForItem}
          />
        )
      })}
    </>
  )
}

export default LabelsList
