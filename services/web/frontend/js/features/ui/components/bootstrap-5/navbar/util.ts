import type {
  NavbarDropdownItem,
  NavbarDropdownItemData,
  NavbarDropdownLinkItem,
  NavbarItemData,
  NavbarLinkItemData,
} from '@/features/ui/components/types/navbar'

export function isDropdownLinkItem(
  item: NavbarDropdownItem
): item is NavbarDropdownLinkItem {
  return 'url' in item
}

export function isDropdownItem(
  item: NavbarItemData
): item is NavbarDropdownItemData {
  return 'dropdown' in item
}

export function isLinkItem(item: NavbarItemData): item is NavbarLinkItemData {
  return 'url' in item
}
