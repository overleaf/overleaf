import { useState } from 'react'
import classnames from 'classnames'
import { Question, User } from '@phosphor-icons/react'
import NewProjectButton from '../new-project-button'
import SidebarFilters from './sidebar-filters'
import AddAffiliation, { useAddAffiliation } from '../add-affiliation'
import { usePersistedResize } from '@/shared/hooks/use-resize'
import { Dropdown } from 'react-bootstrap-5'
import getMeta from '@/utils/meta'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import { useTranslation } from 'react-i18next'
import { NavDropdownMenuItems } from '@/features/ui/components/bootstrap-5/navbar/nav-dropdown-from-data'
import { NavbarDropdownItemData } from '@/features/ui/components/types/navbar'
import { useContactUsModal } from '@/shared/hooks/use-contact-us-modal'
import { UserProvider } from '@/shared/context/user-context'
import { AccountMenuItems } from '@/features/ui/components/bootstrap-5/navbar/account-menu-items'
import { useScrolled } from '@/features/project-list/components/sidebar/use-scroll'
import { useSendProjectListMB } from '@/features/project-list/components/project-list-events'
import { SurveyWidgetDsNav } from '@/features/project-list/components/survey-widget-ds-nav'

function SidebarDsNav() {
  const { t } = useTranslation()
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [showHelpDropdown, setShowHelpDropdown] = useState(false)
  const { showModal: showContactUsModal, modal: contactUsModal } =
    useContactUsModal({
      autofillProjectUrl: false,
    })
  const { show: showAddAffiliationWidget } = useAddAffiliation()
  const { mousePos, getHandleProps, getTargetProps } = usePersistedResize({
    name: 'project-sidebar',
  })
  const sendMB = useSendProjectListMB()
  const { sessionUser, showSubscriptionLink, items } = getMeta('ol-navbar')
  const helpItem = items.find(
    item => item.text === 'help'
  ) as NavbarDropdownItemData
  const { containerRef, scrolledUp, scrolledDown } = useScrolled()
  return (
    <div
      className="project-list-sidebar-wrapper-react d-none d-md-flex"
      {...getTargetProps({
        style: {
          ...(mousePos?.x && { flexBasis: `${mousePos.x}px` }),
        },
      })}
    >
      <NewProjectButton
        id="new-project-button-sidebar"
        className={scrolledDown ? 'show-shadow' : undefined}
      />
      <div className="project-list-sidebar-scroll" ref={containerRef}>
        <SidebarFilters />
        {showAddAffiliationWidget && <hr />}
        <AddAffiliation />
      </div>
      <div
        className={classnames(
          'ds-nav-sidebar-lower',
          scrolledUp && 'show-shadow'
        )}
      >
        <div className="project-list-sidebar-survey-wrapper">
          <SurveyWidgetDsNav />
        </div>
        <div className="d-flex gap-3 mb-2">
          {helpItem && (
            <Dropdown
              className="ds-nav-icon-dropdown"
              onToggle={show => {
                setShowHelpDropdown(show)
                if (show) {
                  sendMB('menu-expand', { item: 'help', location: 'sidebar' })
                }
              }}
            >
              <Dropdown.Toggle role="menuitem" aria-label={t('help')}>
                <OLTooltip
                  description={t('help')}
                  id="help-icon"
                  overlayProps={{
                    placement: 'top',
                    show: showHelpDropdown ? false : undefined,
                  }}
                >
                  <div>
                    <Question size={24} />
                  </div>
                </OLTooltip>
              </Dropdown.Toggle>
              <Dropdown.Menu
                as="ul"
                role="menu"
                align="end"
                popperConfig={{
                  modifiers: [{ name: 'offset', options: { offset: [0, 5] } }],
                }}
              >
                <NavDropdownMenuItems
                  dropdown={helpItem.dropdown}
                  showContactUsModal={showContactUsModal}
                  location="sidebar"
                />
              </Dropdown.Menu>
            </Dropdown>
          )}
          {sessionUser && (
            <>
              <Dropdown
                className="ds-nav-icon-dropdown"
                onToggle={show => {
                  setShowAccountDropdown(show)
                  if (show) {
                    sendMB('menu-expand', {
                      item: 'account',
                      location: 'sidebar',
                    })
                  }
                }}
              >
                <Dropdown.Toggle role="menuitem" aria-label={t('Account')}>
                  <OLTooltip
                    description={t('Account')}
                    id="open-account"
                    overlayProps={{
                      placement: 'top',
                      show: showAccountDropdown ? false : undefined,
                    }}
                  >
                    <div>
                      <User size={24} />
                    </div>
                  </OLTooltip>
                </Dropdown.Toggle>
                <Dropdown.Menu
                  as="ul"
                  role="menu"
                  align="end"
                  popperConfig={{
                    modifiers: [
                      { name: 'offset', options: { offset: [-50, 5] } },
                    ],
                  }}
                >
                  <AccountMenuItems
                    sessionUser={sessionUser}
                    showSubscriptionLink={showSubscriptionLink}
                  />
                </Dropdown.Menu>
              </Dropdown>
              <UserProvider>{contactUsModal}</UserProvider>
            </>
          )}
        </div>
        <div className="ds-nav-ds-link">
          <a
            target="_blank"
            href="https://www.digital-science.com/"
            rel="noopener"
          >
            Digital Science
          </a>
        </div>
      </div>
      <div
        {...getHandleProps({
          style: {
            position: 'absolute',
            zIndex: 1,
            top: 0,
            right: '-2px',
            height: '100%',
            width: '4px',
          },
        })}
      />
    </div>
  )
}

export default SidebarDsNav
