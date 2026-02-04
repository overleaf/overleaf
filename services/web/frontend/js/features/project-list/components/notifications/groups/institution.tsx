import { Fragment } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import Notification from '../notification'
import getMeta from '../../../../../utils/meta'
import useAsyncDismiss from '../hooks/useAsyncDismiss'
import OLButton from '@/shared/components/ol/ol-button'

function Institution() {
  const { t } = useTranslation()
  const { samlInitPath, appName } = getMeta('ol-ExposedSettings')
  const notificationsInstitution = getMeta('ol-notificationsInstitution') || []
  const { handleDismiss } = useAsyncDismiss()

  if (!notificationsInstitution.length) {
    return null
  }

  return (
    <>
      {notificationsInstitution.map(
        (
          {
            _id: id,
            email,
            institutionEmail,
            institutionId,
            institutionName,
            templateKey,
            requestedEmail,
            error,
          },
          index
        ) => (
          <Fragment key={index}>
            {templateKey === 'notification_institution_sso_available' && (
              <Notification
                type="info"
                content={
                  <>
                    <p>
                      <Trans
                        i18nKey="can_link_institution_email_acct_to_institution_acct"
                        components={{ b: <b /> }}
                        values={{ appName, email, institutionName }}
                        shouldUnescape
                        tOptions={{ interpolation: { escapeValue: true } }}
                      />
                    </p>
                    <div>
                      <Trans
                        i18nKey="doing_this_allow_log_in_through_institution"
                        components={{ b: <b /> }}
                        values={{ appName }}
                        shouldUnescape
                        tOptions={{ interpolation: { escapeValue: true } }}
                      />{' '}
                      <a
                        href="/learn/how-to/Institutional_Login"
                        target="_blank"
                      >
                        {t('learn_more')}
                      </a>
                    </div>
                  </>
                }
                action={
                  <OLButton
                    variant="secondary"
                    href={`${samlInitPath}?university_id=${institutionId}&auto=/project&email=${email}`}
                  >
                    {t('link_account')}
                  </OLButton>
                }
              />
            )}
            {templateKey === 'notification_institution_sso_linked' && (
              <Notification
                type="info"
                onDismiss={() => id && handleDismiss(id)}
                content={
                  <Trans
                    i18nKey="account_has_been_link_to_institution_account"
                    components={{ b: <b /> }}
                    values={{ appName, email, institutionName }}
                    shouldUnescape
                    tOptions={{ interpolation: { escapeValue: true } }}
                  />
                }
              />
            )}
            {templateKey === 'notification_group_sso_linked' && (
              <Notification
                type="info"
                onDismiss={() => id && handleDismiss(id)}
                content={
                  <Trans
                    i18nKey="account_has_been_link_to_group_account"
                    components={{ b: <b /> }}
                    values={{ appName, email, institutionName }}
                    shouldUnescape
                    tOptions={{ interpolation: { escapeValue: true } }}
                  />
                }
              />
            )}
            {templateKey ===
              'notification_account_created_via_group_domain_capture_and_managed_users_enabled' && (
              <Notification
                type="info"
                onDismiss={() => id && handleDismiss(id)}
                content={
                  <>
                    <Trans
                      i18nKey="account_managed_by_group_teamname"
                      components={
                        /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
                        [<strong />]
                      }
                      values={{ appName, email, teamName: institutionName }}
                      shouldUnescape
                      tOptions={{ interpolation: { escapeValue: true } }}
                    />
                    &nbsp;
                    <a
                      href="/learn/how-to/Understanding_Managed_Overleaf_Accounts"
                      target="_blank"
                    >
                      {t('understand_managed_user_accounts')}
                    </a>
                  </>
                }
              />
            )}
            {templateKey === 'notification_institution_sso_non_canonical' && (
              <Notification
                type="warning"
                onDismiss={() => id && handleDismiss(id)}
                content={
                  <>
                    <Trans
                      i18nKey="tried_to_log_in_with_email"
                      components={{ b: <b /> }}
                      values={{ appName, email: requestedEmail }}
                      shouldUnescape
                      tOptions={{ interpolation: { escapeValue: true } }}
                    />{' '}
                    <Trans
                      i18nKey="in_order_to_match_institutional_metadata_associated"
                      components={{ b: <b /> }}
                      values={{ email: institutionEmail }}
                      shouldUnescape
                      tOptions={{ interpolation: { escapeValue: true } }}
                    />
                  </>
                }
              />
            )}
            {templateKey ===
              'notification_institution_sso_already_registered' && (
              <Notification
                type="info"
                onDismiss={() => id && handleDismiss(id)}
                content={
                  <>
                    <Trans
                      i18nKey="tried_to_register_with_email"
                      components={{ b: <b /> }}
                      values={{ appName, email }}
                      shouldUnescape
                      tOptions={{ interpolation: { escapeValue: true } }}
                    />{' '}
                    {t('we_logged_you_in')}
                  </>
                }
                action={
                  <OLButton
                    variant="secondary"
                    href="/learn/how-to/Institutional_Login"
                    target="_blank"
                  >
                    {t('find_out_more')}
                  </OLButton>
                }
              />
            )}
            {templateKey === 'notification_institution_sso_error' && (
              <Notification
                type="error"
                onDismiss={() => id && handleDismiss(id)}
                content={
                  <>
                    {t('generic_something_went_wrong')}.
                    <div>
                      {error?.translatedMessage
                        ? error?.translatedMessage
                        : error?.message}
                    </div>
                    {error?.tryAgain ? `${t('try_again')}.` : null}
                  </>
                }
              />
            )}
          </Fragment>
        )
      )}
    </>
  )
}

export default Institution
