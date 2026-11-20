import type { DefaultNavbarMetadata } from '@/shared/components/types/default-navbar-metadata'
import NavDropdownMenu from '@/shared/components/navbar/nav-dropdown-menu'
import NavDropdownLinkItem from '@/shared/components/navbar/nav-dropdown-link-item'
import getMeta from '@/utils/meta'
import { useSendProjectListMB } from '@/features/project-list/components/project-list-events'

export default function AdminMenu({
  canDisplayAdminMenu,
  canDisplayAdminRedirect,
  canDisplayProjectUrlLookup,
  canDisplaySplitTestMenu,
  canDisplaySurveyMenu,
  canDisplayScriptLogMenu,
  adminUrl,
}: Pick<
  DefaultNavbarMetadata,
  | 'canDisplayAdminMenu'
  | 'canDisplayAdminRedirect'
  | 'canDisplayProjectUrlLookup'
  | 'canDisplaySplitTestMenu'
  | 'canDisplaySurveyMenu'
  | 'canDisplayScriptLogMenu'
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
          <NavDropdownLinkItem href="/admin">System Admin</NavDropdownLinkItem>
          <NavDropdownLinkItem href="/admin/user">
            Manage Users
          </NavDropdownLinkItem>
          {getMeta('ol-ExposedSettings')?.hasPackageHubFeature && (
            <NavDropdownLinkItem href="/packages">
              Manage Packages
            </NavDropdownLinkItem>
          )}
        </>
      ) : null}
      {canDisplayProjectUrlLookup ? (
        <NavDropdownLinkItem href="/admin/project">
          Project/Object Lookup
        </NavDropdownLinkItem>
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
      {canDisplayScriptLogMenu ? (
        <NavDropdownLinkItem href="/admin/script-logs">
          View Script Logs
        </NavDropdownLinkItem>
      ) : null}
    </NavDropdownMenu>
  )
}
