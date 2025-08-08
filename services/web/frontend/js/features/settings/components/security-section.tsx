import MaterialIcon from '@/shared/components/material-icon'
import { Trans, useTranslation } from 'react-i18next'
import { GroupSSOLinkingStatus } from '../../../../../types/subscription/sso'
import getMeta from '../../../utils/meta'
import OLButton from '@/shared/components/ol/ol-button'

function SecuritySection() {
  const { t } = useTranslation()

  const memberOfSSOEnabledGroups = getMeta('ol-memberOfSSOEnabledGroups') || []

  return (
    <>
      {memberOfSSOEnabledGroups.length > 0 ? (
        <>
          <h3>{t('security')}</h3>
          {memberOfSSOEnabledGroups.map(
            ({
              groupId,
              linked,
              groupName,
              adminEmail,
            }: GroupSSOLinkingStatus) => (
              <div key={groupId} className="security-row">
                <span className="icon">
                  <MaterialIcon type="key" />
                </span>
                <div className="text">
                  <span className="line-header">
                    <b>{t('single_sign_on_sso')}</b>{' '}
                    {linked ? (
                      <span className="status-label status-label-configured">
                        {t('active')}
                      </span>
                    ) : (
                      <span className="status-label status-label-ready">
                        {t('ready_to_set_up')}
                      </span>
                    )}
                  </span>
                  <div>
                    {linked ? (
                      groupName ? (
                        <Trans
                          i18nKey="sso_user_explanation_enabled_with_group_name"
                          // eslint-disable-next-line react/jsx-key
                          components={[<b />]}
                          values={{ groupName }}
                          shouldUnescape
                          tOptions={{ interpolation: { escapeValue: true } }}
                        />
                      ) : (
                        <Trans
                          i18nKey="sso_user_explanation_enabled_with_admin_email"
                          // eslint-disable-next-line react/jsx-key
                          components={[<b />]}
                          values={{ adminEmail }}
                          shouldUnescape
                          tOptions={{ interpolation: { escapeValue: true } }}
                        />
                      )
                    ) : groupName ? (
                      <Trans
                        i18nKey="sso_user_explanation_ready_with_group_name"
                        // eslint-disable-next-line react/jsx-key
                        components={[<b />, <b />]}
                        values={{ groupName, buttonText: t('set_up_sso') }}
                        shouldUnescape
                        tOptions={{ interpolation: { escapeValue: true } }}
                      />
                    ) : (
                      <Trans
                        i18nKey="sso_user_explanation_ready_with_admin_email"
                        // eslint-disable-next-line react/jsx-key
                        components={[<b />, <b />]}
                        values={{ adminEmail, buttonText: t('set_up_sso') }}
                        shouldUnescape
                        tOptions={{ interpolation: { escapeValue: true } }}
                      />
                    )}
                  </div>
                </div>
                {linked ? null : (
                  <div className="button-column">
                    <OLButton
                      variant="primary"
                      href={`/subscription/${groupId}/sso_enrollment`}
                    >
                      {t('set_up_sso')}
                    </OLButton>
                  </div>
                )}
              </div>
            )
          )}
          <hr />
        </>
      ) : null}
    </>
  )
}

export default SecuritySection
