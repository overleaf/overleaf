import { type Ref, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Question, User } from '@phosphor-icons/react'
import {
  OLDropdown,
  OLDropdownToggle,
  OLDropdownMenu,
} from '@/shared/components/ol/ol-dropdown-menu'
import getMeta from '@/utils/meta'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
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
  accountRef?: Ref<HTMLDivElement>
  onAccountOpen?: () => void
  children?: React.ReactNode
}) {
  const { t } = useTranslation()
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [showHelpDropdown, setShowHelpDropdown] = useState(false)
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
      <nav
        className="d-flex flex-row gap-3 mb-2"
        aria-label={t('account_help')}
      >
        {helpItem && (
          <OLDropdown
            className="ds-nav-icon-dropdown"
            align="end"
            onToggle={show => {
              setShowHelpDropdown(show)
              if (show) {
                sendMB('menu-expand', { item: 'help', location: 'sidebar' })
              }
            }}
            role="menu"
          >
            <OLDropdownToggle role="menuitem" aria-label={t('help')}>
              <OLTooltip
                description={t('help')}
                id="help-icon"
                overlayProps={{
                  placement: 'top',
                }}
                hidden={showHelpDropdown}
              >
                <div>
                  <Question size={24} />
                </div>
              </OLTooltip>
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
            className="ds-nav-icon-dropdown"
            align="end"
            onToggle={show => {
              setShowAccountDropdown(show)
              if (show) {
                sendMB('menu-expand', {
                  item: 'account',
                  location: 'sidebar',
                })
                onAccountOpen?.()
              }
            }}
            role="menu"
          >
            <OLDropdownToggle role="menuitem" aria-label={t('Account')}>
              <OLTooltip
                description={t('Account')}
                id="open-account"
                overlayProps={{
                  placement: 'top',
                }}
                hidden={showAccountDropdown}
              >
                <div ref={accountRef}>
                  <User size={24} />
                </div>
              </OLTooltip>
            </OLDropdownToggle>
            <OLDropdownMenu
              popperConfig={{
                modifiers: [{ name: 'offset', options: { offset: [-50, 5] } }],
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
      </nav>
      <div className="ds-nav-ds-name" translate="no">
        <span>Digital Science</span>
      </div>
      <UserProvider>{contactUsModal}</UserProvider>
    </>
  )
}
