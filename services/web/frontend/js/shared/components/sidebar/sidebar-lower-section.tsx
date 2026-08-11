import { type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { Question, User } from '@phosphor-icons/react'
import {
  OLDropdown,
  OLDropdownToggle,
  OLDropdownMenu,
} from '@/shared/components/ol/ol-dropdown-menu'
import getMeta from '@/utils/meta'
import MaterialIcon from '@/shared/components/material-icon'
import { NavDropdownMenuItems } from '@/shared/components/navbar/nav-dropdown-from-data'
import { NavbarDropdownItemData } from '@/shared/components/types/navbar'
import { useContactUsModal } from '@/shared/hooks/use-contact-us-modal'
import { UserProvider } from '@/shared/context/user-context'
import { AccountMenuItems } from '@/shared/components/navbar/account-menu-items'
import { sendMB } from '@/infrastructure/event-tracking'

export function SidebarLowerSection({
  showThemeToggle = false,
  accountRef,
  onAccountOpen,
  children,
}: {
  showThemeToggle?: boolean
  accountRef?: Ref<HTMLButtonElement>
  onAccountOpen?: () => void
  children?: React.ReactNode
}) {
  const { t } = useTranslation()
  const { showModal: showContactUsModal, modal: contactUsModal } =
    useContactUsModal({
      autofillProjectUrl: false,
    })
  const { sessionUser, showSubscriptionLink, items } = getMeta('ol-navbar')
  const helpItem = items.find(
    item => item.text === 'help_and_resources'
  ) as NavbarDropdownItemData

  return (
    <>
      {children}
      <nav aria-label={t('account_help')}>
        <ul className="list-unstyled ds-nav-dropdown-list">
          {helpItem && (
            <OLDropdown
              as="li"
              role="none"
              className="ds-nav-dropdown"
              align="end"
              onToggle={show => {
                if (show) {
                  sendMB('menu-expand', { item: 'help', location: 'sidebar' })
                }
              }}
            >
              <OLDropdownToggle
                role="menuitem"
                className="ds-nav-page-switcher-item"
              >
                <Question size={20} />
                <span className="ds-nav-page-switcher-item-label">
                  {t('help')}
                </span>
                <MaterialIcon type="more_vert" />
              </OLDropdownToggle>
              <OLDropdownMenu
                popperConfig={{
                  modifiers: [{ name: 'offset', options: { offset: [0, 5] } }],
                }}
              >
                <NavDropdownMenuItems
                  dropdown={helpItem.dropdown}
                  showContactUsModal={showContactUsModal}
                  location="sidebar"
                />
              </OLDropdownMenu>
            </OLDropdown>
          )}
          {sessionUser && (
            <OLDropdown
              as="li"
              role="none"
              className="ds-nav-dropdown"
              align="end"
              onToggle={show => {
                if (show) {
                  sendMB('menu-expand', {
                    item: 'account',
                    location: 'sidebar',
                  })
                  onAccountOpen?.()
                }
              }}
            >
              <OLDropdownToggle
                ref={accountRef}
                role="menuitem"
                className="ds-nav-page-switcher-item"
              >
                <User size={20} />
                <span className="ds-nav-page-switcher-item-label">
                  {t('Account')}
                </span>
                <MaterialIcon type="more_vert" />
              </OLDropdownToggle>
              <OLDropdownMenu
                popperConfig={{
                  modifiers: [{ name: 'offset', options: { offset: [0, 5] } }],
                }}
              >
                <AccountMenuItems
                  sessionUser={sessionUser}
                  showSubscriptionLink={showSubscriptionLink}
                  showThemeToggle={showThemeToggle}
                />
              </OLDropdownMenu>
            </OLDropdown>
          )}
        </ul>
      </nav>
      <div className="ds-nav-ds-name" translate="no">
        <span>Digital Science</span>
      </div>
      <UserProvider>{contactUsModal}</UserProvider>
    </>
  )
}
