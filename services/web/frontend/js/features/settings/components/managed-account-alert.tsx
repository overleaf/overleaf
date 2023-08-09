import { Trans } from 'react-i18next'
import getMeta from '../../../utils/meta'

export default function ManagedAccountAlert() {
  const isManaged = getMeta('ol-isManagedAccount', false)
  const currentManagedUserAdminEmail: string = getMeta(
    'ol-currentManagedUserAdminEmail',
    ''
  )

  if (!isManaged) {
    return null
  }

  return (
    <div className="enrollment-alert">
      <div className="icon">
        <span className="info-badge" />
      </div>
      <div>
        <div>
          <strong>
            <Trans
              i18nKey="account_managed_by_group_administrator"
              values={{
                admin: currentManagedUserAdminEmail,
              }}
            />
          </strong>
        </div>
        <div>
          <Trans
            i18nKey="need_contact_group_admin_to_make_changes"
            // TODO update with actual wiki link once created
            components={[<a href="/learn/how-to/Managed_Users" />]} // eslint-disable-line jsx-a11y/anchor-has-content, react/jsx-key
          />
        </div>
      </div>
    </div>
  )
}
