import { Dispatch, SetStateAction, useCallback, useState } from 'react'
import { LoadedUpdate, Version } from '../services/types/update'

type DropdownItem = LoadedUpdate | Version

export type ActiveDropdownValue = {
  item: DropdownItem | null
  isOpened: boolean
}

export type ActiveDropdown = {
  activeDropdownItem: ActiveDropdownValue
  setActiveDropdownItem: Dispatch<SetStateAction<ActiveDropdownValue>>
  closeDropdownForItem: (item: DropdownItem) => void
}

function useDropdownActiveItem(): ActiveDropdown {
  const [activeDropdownItem, setActiveDropdownItem] =
    useState<ActiveDropdownValue>({
      item: null,
      isOpened: false,
    })

  const closeDropdownForItem = useCallback(
    (item: DropdownItem) => setActiveDropdownItem({ item, isOpened: false }),
    [setActiveDropdownItem]
  )

  return {
    activeDropdownItem,
    setActiveDropdownItem,
    closeDropdownForItem,
  }
}

export default useDropdownActiveItem
