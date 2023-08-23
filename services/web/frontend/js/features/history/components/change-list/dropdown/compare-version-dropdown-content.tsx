import { LoadedUpdate, Version } from '../../../services/types/update'
import { ReactNode, useCallback } from 'react'
import { ActiveDropdown } from '../../../hooks/use-dropdown-active-item'
import { MenuItem } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import CompareItems from './menu-item/compare-items'
import { updateRangeForUpdate } from '../../../utils/history-details'

type VersionDropdownContentAllHistoryProps = {
  update: LoadedUpdate
  closeDropdownForItem: ActiveDropdown['closeDropdownForItem']
}

function CompareVersionDropdownContentAllHistory({
  update,
  closeDropdownForItem,
}: VersionDropdownContentAllHistoryProps) {
  const updateRange = updateRangeForUpdate(update)

  const closeDropdown = useCallback(() => {
    closeDropdownForItem(update, 'compare')
  }, [closeDropdownForItem, update])

  const { t } = useTranslation()

  return (
    <>
      <DropdownOption>
        <CompareItems
          updateRange={updateRange}
          selected="aboveSelected"
          text={t('history_compare_up_to_this_version')}
          closeDropdown={closeDropdown}
        />
      </DropdownOption>
      <DropdownOption>
        <CompareItems
          updateRange={updateRange}
          selected="belowSelected"
          text={t('history_compare_from_this_version')}
          closeDropdown={closeDropdown}
        />
      </DropdownOption>
    </>
  )
}

type VersionDropdownContentLabelsListProps = {
  version: Version
  versionTimestamp: number
  closeDropdownForItem: ActiveDropdown['closeDropdownForItem']
}

function CompareVersionDropdownContentLabelsList({
  version,
  versionTimestamp,
  closeDropdownForItem,
}: VersionDropdownContentLabelsListProps) {
  const closeDropdownLabels = useCallback(() => {
    closeDropdownForItem(version, 'compare')
  }, [closeDropdownForItem, version])

  const { t } = useTranslation()

  return (
    <>
      <DropdownOption>
        <CompareItems
          updateRange={{
            fromV: version,
            toV: version,
            fromVTimestamp: versionTimestamp,
            toVTimestamp: versionTimestamp,
          }}
          selected="aboveSelected"
          text={t('history_compare_up_to_this_version')}
          closeDropdown={closeDropdownLabels}
        />
      </DropdownOption>
      <DropdownOption>
        <CompareItems
          updateRange={{
            fromV: version,
            toV: version,
            fromVTimestamp: versionTimestamp,
            toVTimestamp: versionTimestamp,
          }}
          selected="belowSelected"
          text={t('history_compare_from_this_version')}
          closeDropdown={closeDropdownLabels}
        />
      </DropdownOption>
    </>
  )
}

type DropdownOptionProps = {
  children: ReactNode
}

function DropdownOption({ children, ...props }: DropdownOptionProps) {
  return (
    <>
      <MenuItem {...props}>{children}</MenuItem>
    </>
  )
}

export {
  CompareVersionDropdownContentAllHistory,
  CompareVersionDropdownContentLabelsList,
}
