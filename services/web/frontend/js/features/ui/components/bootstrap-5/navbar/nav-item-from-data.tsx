import type { NavbarItemData } from '@/features/ui/components/types/navbar'
import {
  isDropdownItem,
  isLinkItem,
} from '@/features/ui/components/bootstrap-5/navbar/util'
import NavDropdownFromData from '@/features/ui/components/bootstrap-5/navbar/nav-dropdown-from-data'
import NavItem from '@/features/ui/components/bootstrap-5/navbar/nav-item'
import NavLinkItem from '@/features/ui/components/bootstrap-5/navbar/nav-link-item'
import { useSendProjectListMB } from '@/features/project-list/components/project-list-events'

export default function NavItemFromData({
  item,
  showContactUsModal,
}: {
  item: NavbarItemData
  showContactUsModal: (event?: Event) => void
}) {
  const sendProjectListMB = useSendProjectListMB()
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
          sendProjectListMB('menu-click', {
            item: item.trackingKey as any,
            location: 'top-menu',
            destinationURL: item.url,
          })
        }}
      >
        {item.translatedText}
      </NavLinkItem>
    )
  } else {
    return <NavItem className={item.class}>{item.translatedText}</NavItem>
  }
}
