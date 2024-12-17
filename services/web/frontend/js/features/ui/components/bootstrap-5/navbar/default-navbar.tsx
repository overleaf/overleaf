import { useState } from 'react'
import { sendMB } from '@/infrastructure/event-tracking'
import { useTranslation } from 'react-i18next'
import { Button, Container, Nav, Navbar } from 'react-bootstrap-5'
import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import AdminMenu from '@/features/ui/components/bootstrap-5/navbar/admin-menu'
import type { DefaultNavbarMetadata } from '@/features/ui/components/types/default-navbar-metadata'
import NavItemFromData from '@/features/ui/components/bootstrap-5/navbar/nav-item-from-data'
import LoggedInItems from '@/features/ui/components/bootstrap-5/navbar/logged-in-items'
import LoggedOutItems from '@/features/ui/components/bootstrap-5/navbar/logged-out-items'
import HeaderLogoOrTitle from '@/features/ui/components/bootstrap-5/navbar/header-logo-or-title'
import MaterialIcon from '@/shared/components/material-icon'
import { useContactUsModal } from '@/shared/hooks/use-contact-us-modal'
import { UserProvider } from '@/shared/context/user-context'
import { X } from '@phosphor-icons/react'

function DefaultNavbar(props: DefaultNavbarMetadata) {
  const {
    customLogo,
    title,
    canDisplayAdminMenu,
    canDisplayAdminRedirect,
    canDisplaySplitTestMenu,
    canDisplaySurveyMenu,
    enableUpgradeButton,
    suppressNavbarRight,
    suppressNavContentLinks,
    showCloseIcon = false,
    showSubscriptionLink,
    showSignUpLink,
    sessionUser,
    adminUrl,
    items,
  } = props
  const { t } = useTranslation()
  const { isReady } = useWaitForI18n()
  const [expanded, setExpanded] = useState(false)

  // The Contact Us modal is rendered at this level rather than inside the nav
  // bar because otherwise the help wiki search results dropdown doesn't show up
  const { modal: contactUsModal, showModal: showContactUsModal } =
    useContactUsModal({
      autofillProjectUrl: false,
    })

  if (!isReady) {
    return null
  }

  return (
    <>
      <Navbar
        className="navbar-default navbar-main"
        expand="lg"
        onToggle={expanded => setExpanded(expanded)}
      >
        <Container className="navbar-container" fluid>
          <div className="navbar-header">
            <HeaderLogoOrTitle title={title} customLogo={customLogo} />
            {enableUpgradeButton ? (
              <Button
                as="a"
                href="/user/subscription/plans"
                className="me-2 d-md-none"
                onClick={() => {
                  sendMB('upgrade-button-click', {
                    source: 'dashboard-top',
                    'project-dashboard-react': 'enabled',
                    'is-dashboard-sidebar-hidden': 'true',
                    'is-screen-width-less-than-768px': 'true',
                  })
                }}
              >
                {t('upgrade')}
              </Button>
            ) : null}
          </div>
          {suppressNavbarRight ? null : (
            <>
              <Navbar.Toggle
                aria-controls="navbar-main-collapse"
                aria-expanded="false"
                aria-label={t('main_navigation')}
              >
                {showCloseIcon && expanded ? (
                  <X />
                ) : (
                  <MaterialIcon type="menu" />
                )}
              </Navbar.Toggle>
              <Navbar.Collapse
                id="navbar-main-collapse"
                className="justify-content-end"
              >
                <Nav as="ul" className="ms-auto" role="menubar">
                  {canDisplayAdminMenu ||
                  canDisplayAdminRedirect ||
                  canDisplaySplitTestMenu ? (
                    <AdminMenu
                      canDisplayAdminMenu={canDisplayAdminMenu}
                      canDisplayAdminRedirect={canDisplayAdminRedirect}
                      canDisplaySplitTestMenu={canDisplaySplitTestMenu}
                      canDisplaySurveyMenu={canDisplaySurveyMenu}
                      adminUrl={adminUrl}
                    />
                  ) : null}
                  {items.map((item, index) => {
                    const showNavItem =
                      (item.only_when_logged_in && sessionUser) ||
                      (item.only_when_logged_out && sessionUser) ||
                      (!item.only_when_logged_out &&
                        !item.only_when_logged_in &&
                        !item.only_content_pages) ||
                      (item.only_content_pages && !suppressNavContentLinks)

                    return showNavItem ? (
                      <NavItemFromData
                        item={item}
                        key={index}
                        showContactUsModal={showContactUsModal}
                      />
                    ) : null
                  })}
                  {sessionUser ? (
                    <LoggedInItems
                      sessionUser={sessionUser}
                      showSubscriptionLink={showSubscriptionLink}
                    />
                  ) : (
                    <LoggedOutItems showSignUpLink={showSignUpLink} />
                  )}
                </Nav>
              </Navbar.Collapse>
            </>
          )}
        </Container>
      </Navbar>
      <UserProvider>{contactUsModal}</UserProvider>
    </>
  )
}

export default DefaultNavbar
