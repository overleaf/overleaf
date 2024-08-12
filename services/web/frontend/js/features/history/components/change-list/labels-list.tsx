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
        const selectionState = isVersionSelected(selection, version)
        const dropdownActive =
          version === activeDropdownItem.item &&
          activeDropdownItem.whichDropDown === 'moreOptions'
        const compareDropdownActive =
          version === activeDropdownItem.item &&
          activeDropdownItem.whichDropDown === 'compare'

        return (
          <LabelListItem
            key={version}
            labels={labels}
            version={version}
            currentUserId={currentUserId!}
            projectId={projectId}
            selectionState={selectionState}
            selectable={selectionState !== 'selected'}
            setSelection={setSelection}
            dropdownOpen={activeDropdownItem.isOpened && dropdownActive}
            dropdownActive={dropdownActive}
            compareDropdownActive={compareDropdownActive}
            compareDropdownOpen={
              activeDropdownItem.isOpened && compareDropdownActive
            }
            setActiveDropdownItem={setActiveDropdownItem}
            closeDropdownForItem={closeDropdownForItem}
          />
        )
      })}
    </>
  )
}

export default LabelsList
