import { Dispatch, SetStateAction, useCallback, useState } from 'react'
import { LoadedUpdate, Version } from '../services/types/update'

type DropdownItem = LoadedUpdate | Version
type WhichDropDownType = 'moreOptions' | 'compare' | null

export type ActiveDropdownValue = {
  item: DropdownItem | null
  isOpened: boolean
  whichDropDown: WhichDropDownType
}

export type ActiveDropdown = {
  activeDropdownItem: ActiveDropdownValue
  setActiveDropdownItem: Dispatch<SetStateAction<ActiveDropdownValue>>
  closeDropdownForItem: (
    item: DropdownItem,
    whichDropDown: WhichDropDownType
  ) => void
}

function useDropdownActiveItem(): ActiveDropdown {
  const [activeDropdownItem, setActiveDropdownItem] =
    useState<ActiveDropdownValue>({
      item: null,
      isOpened: false,
      whichDropDown: null,
    })

  const closeDropdownForItem = useCallback(
    (item: DropdownItem, whichDropDown: WhichDropDownType) =>
      setActiveDropdownItem({ item, isOpened: false, whichDropDown }),
    [setActiveDropdownItem]
  )

  return {
    activeDropdownItem,
    setActiveDropdownItem,
    closeDropdownForItem,
  }
}

export default useDropdownActiveItem
