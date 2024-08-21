import type { DefaultNavbarMetadata } from '@/features/ui/components/types/default-navbar-metadata'
import NavDropdownMenu from '@/features/ui/components/bootstrap-5/navbar/nav-dropdown-menu'
import NavDropdownLinkItem from '@/features/ui/components/bootstrap-5/navbar/nav-dropdown-link-item'

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
  return (
    <NavDropdownMenu title="Admin" className="subdued">
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
