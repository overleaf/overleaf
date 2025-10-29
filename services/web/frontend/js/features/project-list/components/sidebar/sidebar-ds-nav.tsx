import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import classnames from 'classnames'
import { Question, User } from '@phosphor-icons/react'
import NewProjectButton from '../new-project-button'
import SidebarFilters from './sidebar-filters'
import AddAffiliation, { useAddAffiliation } from '../add-affiliation'
import { usePersistedResize } from '@/shared/hooks/use-resize'
import { Dropdown } from 'react-bootstrap'
import getMeta from '@/utils/meta'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { NavDropdownMenuItems } from '@/shared/components/navbar/nav-dropdown-from-data'
import { NavbarDropdownItemData } from '@/shared/components/types/navbar'
import { useContactUsModal } from '@/shared/hooks/use-contact-us-modal'
import { UserProvider } from '@/shared/context/user-context'
import { AccountMenuItems } from '@/shared/components/navbar/account-menu-items'
import { useScrolled } from '@/features/project-list/components/sidebar/use-scroll'
import { useSendProjectListMB } from '@/features/project-list/components/project-list-events'
import { SurveyWidgetDsNav } from '@/features/project-list/components/survey-widget-ds-nav'
import { useFeatureFlag } from '@/shared/context/split-test-context'

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
    item => item.text === 'help_and_resources'
  ) as NavbarDropdownItemData
  const { containerRef, scrolledUp, scrolledDown } = useScrolled()
  const themedDsNav = useFeatureFlag('themed-project-dashboard')

  return (
    <div
      className="project-list-sidebar-wrapper-react d-none d-md-flex"
      {...getTargetProps({
        style: {
          ...(mousePos?.x && { flexBasis: `${mousePos.x}px` }),
        },
      })}
    >
      <nav
        className="flex-grow flex-shrink"
        aria-label={t('project_categories_tags')}
      >
        <NewProjectButton
          id="new-project-button-sidebar"
          className={scrolledDown ? 'show-shadow' : undefined}
        />
        <div
          className="project-list-sidebar-scroll"
          ref={containerRef}
          data-testid="project-list-sidebar-scroll"
        >
          <SidebarFilters />
          {showAddAffiliationWidget && <hr />}
          <AddAffiliation />
        </div>
      </nav>
      <div
        className={classnames(
          'ds-nav-sidebar-lower',
          scrolledUp && 'show-shadow'
        )}
      >
        <div className="project-list-sidebar-survey-wrapper">
          <SurveyWidgetDsNav />
        </div>
        <nav
          className="d-flex flex-row gap-3 mb-2"
          aria-label={t('account_help')}
        >
          {helpItem && (
            <Dropdown
              className="ds-nav-icon-dropdown"
              onToggle={show => {
                setShowHelpDropdown(show)
                if (show) {
                  sendMB('menu-expand', { item: 'help', location: 'sidebar' })
                }
              }}
              role="menu"
            >
              <Dropdown.Toggle role="menuitem" aria-label={t('help')}>
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
                role="menu"
              >
                <Dropdown.Toggle role="menuitem" aria-label={t('Account')}>
                  <OLTooltip
                    description={t('Account')}
                    id="open-account"
                    overlayProps={{
                      placement: 'top',
                    }}
                    hidden={showAccountDropdown}
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
                    showThemeToggle={themedDsNav}
                  />
                </Dropdown.Menu>
              </Dropdown>
              <UserProvider>{contactUsModal}</UserProvider>
            </>
          )}
        </nav>
        <div className="ds-nav-ds-name" translate="no">
          <span>Digital Science</span>
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
