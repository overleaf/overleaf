import { Trans, useTranslation } from 'react-i18next'
import getMeta from '../../../utils/meta'

export default function ManagedAccountAlert() {
  const { t } = useTranslation()
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
            {t('account_managed_by_group_administrator', {
              admin: currentManagedUserAdminEmail,
            })}
          </strong>
        </div>
        <div>
          <Trans
            i18nKey="need_contact_group_admin_to_make_changes"
            components={[
              // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
              <a
                href="/learn/how-to/Understanding_Managed_Overleaf_Accounts"
                target="_blank"
              />,
            ]}
          />
        </div>
      </div>
    </div>
  )
}
