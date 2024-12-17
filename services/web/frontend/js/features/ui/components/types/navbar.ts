export interface NavbarDropdownDivider {
  divider: true
}

export interface NavbarDropdownContactUsItem {
  isContactUs: true
}

export interface NavbarDropdownTextItem {
  text: string
  translatedText: string
  class?: string
}

export interface NavbarDropdownLinkItem extends NavbarDropdownTextItem {
  url: string
  event: string
  eventSegmentation?: Record<string, any>
}

export type NavbarDropdownItem =
  | NavbarDropdownDivider
  | NavbarDropdownContactUsItem
  | NavbarDropdownTextItem
  | NavbarDropdownLinkItem

export type NavbarItemDropdownData = NavbarDropdownItem[]

export interface NavbarTextItemData {
  text: string
  translatedText: string
  only_when_logged_in?: boolean
  only_when_logged_out?: boolean
  only_content_pages?: boolean
  class?: string
}

export interface NavbarDropdownItemData extends NavbarTextItemData {
  dropdown: NavbarItemDropdownData
}

export interface NavbarLinkItemData extends NavbarTextItemData {
  url: string
  event: string
}

export type NavbarItemData =
  | NavbarDropdownItemData
  | NavbarLinkItemData
  | NavbarTextItemData

export type NavbarSessionUser = { email: string }
