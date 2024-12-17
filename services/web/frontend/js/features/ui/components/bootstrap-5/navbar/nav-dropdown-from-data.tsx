import type {
  NavbarDropdownItemData,
  NavbarItemDropdownData,
} from '@/features/ui/components/types/navbar'
import NavDropdownDivider from '@/features/ui/components/bootstrap-5/navbar/nav-dropdown-divider'
import { isDropdownLinkItem } from '@/features/ui/components/bootstrap-5/navbar/util'
import NavDropdownLinkItem from '@/features/ui/components/bootstrap-5/navbar/nav-dropdown-link-item'
import DropdownListItem from '@/features/ui/components/bootstrap-5/dropdown-list-item'
import NavDropdownMenu from '@/features/ui/components/bootstrap-5/navbar/nav-dropdown-menu'
import ContactUsItem from '@/features/ui/components/bootstrap-5/navbar/contact-us-item'
import {
  type ExtraSegmentations,
  useSendProjectListMB,
} from '@/features/project-list/components/project-list-events'

export default function NavDropdownFromData({
  item,
  showContactUsModal,
}: {
  item: NavbarDropdownItemData
  showContactUsModal: (event?: Event) => void
}) {
  const sendProjectListMB = useSendProjectListMB()
  return (
    <NavDropdownMenu
      title={item.translatedText}
      className={item.class}
      onToggle={nextShow => {
        if (nextShow) {
          sendProjectListMB('menu-expand', {
            item: item.trackingKey,
            location: 'top-menu',
          })
        }
      }}
    >
      <NavDropdownMenuItems
        dropdown={item.dropdown}
        showContactUsModal={showContactUsModal}
        location="top-menu"
      />
    </NavDropdownMenu>
  )
}

export function NavDropdownMenuItems({
  dropdown,
  showContactUsModal,
  location,
}: {
  dropdown: NavbarItemDropdownData
  showContactUsModal: (event?: Event) => void
  location: ExtraSegmentations['menu-expand']['location']
}) {
  const sendProjectListMB = useSendProjectListMB()
  return (
    <>
      {dropdown.map((child, index) => {
        if ('divider' in child) {
          return <NavDropdownDivider key={index} />
        } else if ('isContactUs' in child) {
          return (
            <ContactUsItem
              key={index}
              showModal={showContactUsModal}
              location={location}
            />
          )
        } else if (isDropdownLinkItem(child)) {
          return (
            <NavDropdownLinkItem
              key={index}
              href={child.url}
              onClick={() => {
                sendProjectListMB('menu-click', {
                  item: child.trackingKey as ExtraSegmentations['menu-click']['item'],
                  location,
                  destinationURL: child.url,
                })
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
    </>
  )
}
