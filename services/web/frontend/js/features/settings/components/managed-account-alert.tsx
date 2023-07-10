import { Trans, useTranslation } from 'react-i18next'
import getMeta from '../../../utils/meta'

export default function ManagedAccountAlert() {
  const { t } = useTranslation()
  const isManaged = getMeta('ol-isManagedAccount', false)

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
          <strong>{t('account_managed_by_group_administrator')}</strong>
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
