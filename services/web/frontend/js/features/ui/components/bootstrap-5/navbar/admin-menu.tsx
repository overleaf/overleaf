import type { DefaultNavbarMetadata } from '@/features/ui/components/types/default-navbar-metadata'
import NavDropdownMenu from '@/features/ui/components/bootstrap-5/navbar/nav-dropdown-menu'
import NavDropdownLinkItem from '@/features/ui/components/bootstrap-5/navbar/nav-dropdown-link-item'
import { useSendProjectListMB } from '@/features/project-list/components/project-list-events'

export default function AdminMenu({
  canDisplayAdminMenu,
  canDisplayAdminRedirect,
  canDisplaySplitTestMenu,
  canDisplaySurveyMenu,
  adminUrl,
}: Pick<
  DefaultNavbarMetadata,
  | 'canDisplayAdminMenu'
  | 'canDisplayAdminRedirect'
  | 'canDisplaySplitTestMenu'
  | 'canDisplaySurveyMenu'
  | 'adminUrl'
>) {
  const sendProjectListMB = useSendProjectListMB()
  return (
    <NavDropdownMenu
      title="Admin"
      className="subdued"
      onToggle={nextShow => {
        if (nextShow) {
          sendProjectListMB('menu-expand', {
            item: 'admin',
            location: 'top-menu',
          })
        }
      }}
    >
      {canDisplayAdminMenu ? (
        <>
          <NavDropdownLinkItem href="/admin">Manage Site</NavDropdownLinkItem>
          <NavDropdownLinkItem href="/admin/user">
            Manage Users
          </NavDropdownLinkItem>
          <NavDropdownLinkItem href="/admin/project">
            Project URL lookup
          </NavDropdownLinkItem>
        </>
      ) : null}
      {canDisplayAdminRedirect && adminUrl ? (
        <NavDropdownLinkItem href={adminUrl}>
          Switch to Admin
        </NavDropdownLinkItem>
      ) : null}
      {canDisplaySplitTestMenu ? (
        <NavDropdownLinkItem href="/admin/split-test">
          Manage Feature Flags
        </NavDropdownLinkItem>
      ) : null}
      {canDisplaySurveyMenu ? (
        <NavDropdownLinkItem href="/admin/survey">
          Manage Surveys
        </NavDropdownLinkItem>
      ) : null}
    </NavDropdownMenu>
  )
}
