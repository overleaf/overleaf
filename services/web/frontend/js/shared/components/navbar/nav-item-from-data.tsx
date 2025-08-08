import type { NavbarItemData } from '@/shared/components/types/navbar'
import { isDropdownItem, isLinkItem } from '@/shared/components/navbar/util'
import NavDropdownFromData from '@/shared/components/navbar/nav-dropdown-from-data'
import NavItem from '@/shared/components/navbar/nav-item'
import NavLinkItem from '@/shared/components/navbar/nav-link-item'
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
