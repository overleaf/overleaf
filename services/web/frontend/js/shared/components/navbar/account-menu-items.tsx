import { OLDropdownItem } from '@/shared/components/ol/ol-dropdown-menu'
import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'
import type { NavbarSessionUser } from '@/shared/components/types/navbar'
import DropdownListItem from '@/shared/components/dropdown/dropdown-list-item'
import NavDropdownDivider from './nav-dropdown-divider'
import NavDropdownLinkItem from './nav-dropdown-link-item'
import { useDsNavStyle } from '@/features/project-list/components/use-is-ds-nav'
import { SignOut } from '@phosphor-icons/react'
import ThemeToggle from '@/features/project-list/components/sidebar/theme-toggle'
import { OfflineDocBackup } from '@/features/ide-react/editor/offline-doc-backup'
import { ConnectionOutageTracker } from '@/features/ide-react/editor/connection-outage-tracker'

export function AccountMenuItems({
  sessionUser,
  showSubscriptionLink,
  showThemeToggle = false,
}: {
  sessionUser: NavbarSessionUser
  showSubscriptionLink: boolean
  showThemeToggle?: boolean
}) {
  const { t } = useTranslation()
  const logOutFormId = 'logOutForm'
  const dsNavStyle = useDsNavStyle()
  const hasOverallThemes = Boolean(getMeta('ol-overallThemes'))

  return (
    <>
      <OLDropdownItem as="li" disabled role="menuitem">
        {sessionUser.email}
      </OLDropdownItem>
      <NavDropdownDivider />
      <NavDropdownLinkItem href="/user/settings">
        {t('account_settings')}
      </NavDropdownLinkItem>
      {showSubscriptionLink ? (
        <NavDropdownLinkItem href="/user/subscription">
          {t('subscription')}
        </NavDropdownLinkItem>
      ) : null}
      {showThemeToggle && hasOverallThemes && (
        <DropdownListItem>
          <ThemeToggle />
        </DropdownListItem>
      )}

      <NavDropdownDivider />
      <DropdownListItem>
        {
          // The button is outside the form but still belongs to it via the
          // form attribute. The reason to do this is that if the button is
          // inside the form, screen readers will not count it in the total
          // number of menu items
        }
        <OLDropdownItem
          as="button"
          type="submit"
          form={logOutFormId}
          role="menuitem"
          className="d-flex align-items-center justify-content-between"
        >
          <span>{t('log_out')}</span>
          {dsNavStyle && <SignOut size={16} />}
        </OLDropdownItem>
        <form
          id={logOutFormId}
          method="POST"
          action="/logout"
          onSubmit={() => {
            OfflineDocBackup.clearAll()
            ConnectionOutageTracker.clearAll()
          }}
        >
          <input type="hidden" name="_csrf" value={getMeta('ol-csrfToken')} />
        </form>
      </DropdownListItem>
    </>
  )
}
