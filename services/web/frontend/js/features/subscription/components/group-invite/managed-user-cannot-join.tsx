import { Trans, useTranslation } from 'react-i18next'
import Notification from '@/shared/components/notification'
import getMeta from '@/utils/meta'

export default function ManagedUserCannotJoin() {
  const { t } = useTranslation()
  const currentManagedUserAdminEmail = getMeta(
    'ol-currentManagedUserAdminEmail'
  )

  return (
    <Notification
      type="info"
      title={t('you_cant_join_this_group_subscription')}
      content={
        <p>
          <Trans
            i18nKey="your_account_is_managed_by_admin_cant_join_additional_group"
            values={{ admin: currentManagedUserAdminEmail }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
            components={[
              /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
              <a href="/learn/how-to/Understanding_Managed_Overleaf_Accounts" />,
            ]}
          />
        </p>
      }
    />
  )
}
