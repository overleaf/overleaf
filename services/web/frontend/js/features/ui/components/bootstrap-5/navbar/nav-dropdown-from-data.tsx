import type { NavbarDropdownItemData } from '@/features/ui/components/types/navbar'
import NavDropdownDivider from '@/features/ui/components/bootstrap-5/navbar/nav-dropdown-divider'
import { sendMB } from '@/infrastructure/event-tracking'
import { isDropdownLinkItem } from '@/features/ui/components/bootstrap-5/navbar/util'
import NavDropdownLinkItem from '@/features/ui/components/bootstrap-5/navbar/nav-dropdown-link-item'
import DropdownListItem from '@/features/ui/components/bootstrap-5/dropdown-list-item'
import NavDropdownMenu from '@/features/ui/components/bootstrap-5/navbar/nav-dropdown-menu'
import ContactUsItem from '@/features/ui/components/bootstrap-5/navbar/contact-us-item'

export default function NavDropdownFromData({
  item,
  showContactUsModal,
}: {
  item: NavbarDropdownItemData
  showContactUsModal: (event?: Event) => void
}) {
  return (
    <NavDropdownMenu title={item.translatedText} className={item.class}>
      {item.dropdown.map((child, index) => {
        if ('divider' in child) {
          return <NavDropdownDivider key={index} />
        } else if ('isContactUs' in child) {
          return <ContactUsItem key={index} showModal={showContactUsModal} />
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
            <DropdownListItem key={index}>
              {child.translatedText}
            </DropdownListItem>
          )
        }
      })}
    </NavDropdownMenu>
  )
}
