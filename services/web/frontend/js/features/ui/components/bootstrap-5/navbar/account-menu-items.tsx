import { Dropdown } from 'react-bootstrap-5'
import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'
import type { NavbarSessionUser } from '@/features/ui/components/types/navbar'
import DropdownListItem from '@/features/ui/components/bootstrap-5/dropdown-list-item'
import NavDropdownDivider from './nav-dropdown-divider'
import NavDropdownLinkItem from './nav-dropdown-link-item'
import { useDsNavStyle } from '@/features/project-list/components/use-is-ds-nav'
import { SignOut } from '@phosphor-icons/react'

export function AccountMenuItems({
  sessionUser,
  showSubscriptionLink,
}: {
  sessionUser: NavbarSessionUser
  showSubscriptionLink: boolean
}) {
  const { t } = useTranslation()
  const logOutFormId = 'logOutForm'
  const dsNavStyle = useDsNavStyle()
  return (
    <>
      <Dropdown.Item as="li" disabled role="menuitem">
        {sessionUser.email}
      </Dropdown.Item>
      <NavDropdownDivider />
      <NavDropdownLinkItem href="/user/settings">
        {t('Account Settings')}
      </NavDropdownLinkItem>
      {showSubscriptionLink ? (
        <NavDropdownLinkItem href="/user/subscription">
          {t('subscription')}
        </NavDropdownLinkItem>
      ) : null}
      <NavDropdownDivider />
      <DropdownListItem>
        {
          // The button is outside the form but still belongs to it via the
          // form attribute. The reason to do this is that if the button is
          // inside the form, screen readers will not count it in the total
          // number of menu items
        }
        <Dropdown.Item
          as="button"
          type="submit"
          form={logOutFormId}
          role="menuitem"
          className="d-flex align-items-center justify-content-between"
        >
          <span>{t('log_out')}</span>
          {dsNavStyle && <SignOut size={16} />}
        </Dropdown.Item>
        <form id={logOutFormId} method="POST" action="/logout">
          <input type="hidden" name="_csrf" value={getMeta('ol-csrfToken')} />
        </form>
      </DropdownListItem>
    </>
  )
}
