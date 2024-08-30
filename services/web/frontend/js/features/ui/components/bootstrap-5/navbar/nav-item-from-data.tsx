import type { NavbarItemData } from '@/features/ui/components/types/navbar'
import {
  isDropdownItem,
  isLinkItem,
} from '@/features/ui/components/bootstrap-5/navbar/util'
import NavDropdownFromData from '@/features/ui/components/bootstrap-5/navbar/nav-dropdown-from-data'
import NavItem from '@/features/ui/components/bootstrap-5/navbar/nav-item'
import { sendMB } from '@/infrastructure/event-tracking'
import NavLinkItem from '@/features/ui/components/bootstrap-5/navbar/nav-link-item'

export default function NavItemFromData({
  item,
  showContactUsModal,
}: {
  item: NavbarItemData
  showContactUsModal: (event?: Event) => void
}) {
  if (isDropdownItem(item)) {
    return (
      <NavDropdownFromData
        item={item}
        showContactUsModal={showContactUsModal}
      />
    )
  } else if (isLinkItem(item)) {
    return (
      <NavLinkItem
        className={item.class}
        href={item.url}
        onClick={() => {
          sendMB(item.event)
        }}
      >
        {item.translatedText}
      </NavLinkItem>
    )
  } else {
    return <NavItem className={item.class}>{item.translatedText}</NavItem>
  }
}
