import type { NavbarDropdownItemData } from '@/features/ui/components/types/navbar'
import NavDropdownDivider from '@/features/ui/components/bootstrap-5/navbar/nav-dropdown-divider'
import { sendMB } from '@/infrastructure/event-tracking'
import { isDropdownLinkItem } from '@/features/ui/components/bootstrap-5/navbar/util'
import NavDropdownLinkItem from '@/features/ui/components/bootstrap-5/navbar/nav-dropdown-link-item'
import NavDropdownItem from '@/features/ui/components/bootstrap-5/navbar/nav-dropdown-item'
import NavDropdownMenu from '@/features/ui/components/bootstrap-5/navbar/nav-dropdown-menu'
import ContactUsItem from '@/features/ui/components/bootstrap-5/navbar/contact-us-item'

export default function NavDropdownFromData({
  item,
}: {
  item: NavbarDropdownItemData
}) {
  return (
    <NavDropdownMenu title={item.translatedText} className={item.class}>
      {item.dropdown.map((child, index) => {
        if ('divider' in child) {
          return <NavDropdownDivider key={index} />
        } else if ('isContactUs' in child) {
          return <ContactUsItem key={index} />
        } else if (isDropdownLinkItem(child)) {
          return (
            <NavDropdownLinkItem
              key={index}
              href={child.url}
              onClick={() => {
                sendMB(child.event)
              }}
            >
              {child.translatedText}
            </NavDropdownLinkItem>
          )
        } else {
          return (
            <NavDropdownItem key={index}>
              {child.translatedText}
            </NavDropdownItem>
          )
        }
      })}
    </NavDropdownMenu>
  )
}
