import { useTranslation, Trans } from 'react-i18next'
import { Button } from 'react-bootstrap'
import Notification from '../notification'
import Icon from '../../../../../shared/components/icon'
import getMeta from '../../../../../utils/meta'
import useAsyncDismiss from '../hooks/useAsyncDismiss'
import useAsync from '../../../../../shared/hooks/use-async'
import { FetchError, postJSON } from '../../../../../infrastructure/fetch-json'
import { ExposedSettings } from '../../../../../../../types/exposed-settings'
import {
  NotificationProjectInvite,
  Notification as NotificationType,
} from '../../../../../../../types/project/dashboard/notification'
import { User } from '../../../../../../../types/user'
import GroupInvitationNotification from './group-invitation/group-invitation'
import IEEERetirementBanner from '../ieee-retirement-banner'
import { debugConsole } from '@/utils/debugging'

function Common() {
  const notifications = getMeta('ol-notifications', []) as NotificationType[]
  if (!notifications.length) {
    return null
  }

  return (
    <>
      {notifications.map((notification, index) => (
        <CommonNotification notification={notification} key={index} />
      ))}
    </>
  )
}

type CommonNotificationProps = {
  notification: NotificationType
}

function CommonNotification({ notification }: CommonNotificationProps) {
  const { t } = useTranslation()
  const { samlInitPath } = getMeta('ol-ExposedSettings') as ExposedSettings
  const user = getMeta('ol-user', []) as Pick<User, 'features'>
  const newNotificationStyle = getMeta(
    'ol-newNotificationStyle',
    false
  ) as boolean
  const { isLoading, isSuccess, error, runAsync } = useAsync<
    never,
    FetchError
  >()
  const { handleDismiss } = useAsyncDismiss()

  // 404 probably means the invite has already been accepted and deleted. Treat as success
  const accepted = isSuccess || error?.response?.status === 404

  function handleAcceptInvite(notification: NotificationProjectInvite) {
    const {
      messageOpts: { projectId, token },
    } = notification

    runAsync(
      postJSON(`/project/${projectId}/invite/token/${token}/accept`)
    ).catch(debugConsole.error)
  }

  const { _id: id, templateKey, html } = notification

  // Temporarily remove IEEE Collabratec notification
  if (templateKey === 'notification_ieee_collabratec_retirement') {
    return null
  }

  return (
    <>
      {templateKey === 'notification_project_invite' ? (
        <Notification
          bsStyle="info"
          onDismiss={() => id && handleDismiss(id)}
          body={
            accepted ? (
              <Trans
                i18nKey="notification_project_invite_accepted_message"
                components={{ b: <b /> }}
                values={{ projectName: notification.messageOpts.projectName }}
                shouldUnescape
                tOptions={{ interpolation: { escapeValue: true } }}
              />
            ) : (
              <Trans
                i18nKey="notification_project_invite_message"
                components={{ b: <b /> }}
                values={{
                  userName: notification.messageOpts.userName,
                  projectName: notification.messageOpts.projectName,
                }}
                shouldUnescape
                tOptions={{ interpolation: { escapeValue: true } }}
              />
            )
          }
          action={
            accepted ? (
              <Button
                bsStyle={newNotificationStyle ? null : 'info'}
                bsSize="sm"
                className={
                  newNotificationStyle ? 'btn-secondary' : 'pull-right'
                }
                href={`/project/${notification.messageOpts.projectId}`}
              >
                {t('open_project')}
              </Button>
            ) : (
              <Button
                bsStyle={newNotificationStyle ? null : 'info'}
                className={
                  newNotificationStyle ? 'btn-secondary' : 'pull-right'
                }
                bsSize="sm"
                disabled={isLoading}
                onClick={() => handleAcceptInvite(notification)}
              >
                {isLoading ? (
                  <>
                    <Icon type="spinner" spin /> {t('joining')}&hellip;
                  </>
                ) : (
                  t('join_project')
                )}
              </Button>
            )
          }
        />
      ) : templateKey === 'wfh_2020_upgrade_offer' ? (
        <Notification
          bsStyle="info"
          onDismiss={() => id && handleDismiss(id)}
          body={
            <>
              Important notice: Your free WFH2020 upgrade came to an end on June
              30th 2020. We're still providing a number of special initiatives
              to help you continue collaborating throughout 2020.
            </>
          }
          action={
            <Button
              bsStyle={newNotificationStyle ? null : 'info'}
              bsSize="sm"
              className={newNotificationStyle ? 'btn-secondary' : 'pull-right'}
              href="https://www.overleaf.com/events/wfh2020"
            >
              View
            </Button>
          }
        />
      ) : templateKey === 'notification_ip_matched_affiliation' ? (
        <Notification
          bsStyle="info"
          onDismiss={() => id && handleDismiss(id)}
          body={
            <>
              <Trans
                i18nKey="looks_like_youre_at"
                components={[<b />]} // eslint-disable-line react/jsx-key
                values={{
                  institutionName: notification.messageOpts.university_name,
                }}
                shouldUnescape
                tOptions={{ interpolation: { escapeValue: true } }}
              />
              <br />
              {notification.messageOpts.ssoEnabled ? (
                <>
                  <Trans
                    i18nKey="you_can_now_log_in_sso"
                    components={[<b />]} // eslint-disable-line react/jsx-key
                  />
                  <br />
                  {t('link_institutional_email_get_started')}{' '}
                  <a
                    href={
                      notification.messageOpts.portalPath ||
                      'https://www.overleaf.com/learn/how-to/Institutional_Login'
                    }
                  >
                    {t('find_out_more_nt')}
                  </a>
                </>
              ) : (
                <>
                  <Trans
                    i18nKey="did_you_know_institution_providing_professional"
                    components={[<b />]} // eslint-disable-line react/jsx-key
                    values={{
                      institutionName: notification.messageOpts.university_name,
                    }}
                    shouldUnescape
                    tOptions={{ interpolation: { escapeValue: true } }}
                  />
                  <br />
                  {t('add_email_to_claim_features')}
                </>
              )}
            </>
          }
          action={
            <Button
              bsStyle={newNotificationStyle ? null : 'info'}
              bsSize="sm"
              className={newNotificationStyle ? 'btn-secondary' : 'pull-right'}
              href={
                notification.messageOpts.ssoEnabled
                  ? `${samlInitPath}?university_id=${notification.messageOpts.institutionId}&auto=/project`
                  : '/user/settings'
              }
            >
              {notification.messageOpts.ssoEnabled
                ? t('link_account')
                : t('add_affiliation')}
            </Button>
          }
        />
      ) : templateKey === 'notification_tpds_file_limit' ? (
        <Notification
          bsStyle="danger"
          onDismiss={() => id && handleDismiss(id)}
          body={
            <>
              Error: Your project {notification.messageOpts.projectName} has
              gone over the 2000 file limit using an integration (e.g. Dropbox
              or GitHub) <br />
              Please decrease the size of your project to prevent further
              errors.
            </>
          }
          action={
            <Button
              bsStyle={newNotificationStyle ? null : 'danger'}
              bsSize="sm"
              className={newNotificationStyle ? 'btn-secondary' : 'pull-right'}
              href="/user/settings"
            >
              Account Settings
            </Button>
          }
        />
      ) : templateKey === 'notification_dropbox_duplicate_project_names' ? (
        <Notification
          bsStyle="warning"
          onDismiss={() => id && handleDismiss(id)}
          body={
            <>
              <p>
                <Trans
                  i18nKey="dropbox_duplicate_project_names"
                  components={[<b />]} // eslint-disable-line react/jsx-key
                  values={{ projectName: notification.messageOpts.projectName }}
                  shouldUnescape
                  tOptions={{ interpolation: { escapeValue: true } }}
                />
              </p>
              <p>
                <Trans
                  i18nKey="dropbox_duplicate_project_names_suggestion"
                  components={[<b />]} // eslint-disable-line react/jsx-key
                />{' '}
                <a
                  href="/learn/how-to/Dropbox_Synchronization#Troubleshooting"
                  target="_blank"
                >
                  {t('learn_more')}
                </a>
                .
              </p>
            </>
          }
        />
      ) : templateKey ===
        'notification_dropbox_unlinked_due_to_lapsed_reconfirmation' ? (
        <Notification
          bsStyle="info"
          onDismiss={() => id && handleDismiss(id)}
          body={
            <>
              <Trans
                i18nKey="dropbox_unlinked_premium_feature"
                components={[<b />]} // eslint-disable-line react/jsx-key
              />{' '}
              {user.features?.dropbox ? (
                <Trans
                  i18nKey="can_now_relink_dropbox"
                  /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
                  components={[<a href="/user/settings#project-sync" />]}
                />
              ) : (
                t('confirm_affiliation_to_relink_dropbox')
              )}{' '}
              <a
                href="/learn/how-to/Institutional_Email_Reconfirmation"
                target="_blank"
              >
                {t('learn_more')}
              </a>
            </>
          }
        />
      ) : templateKey === 'notification_group_invitation' ? (
        <GroupInvitationNotification notification={notification} />
      ) : templateKey === 'notification_ieee_collabratec_retirement' ? (
        <IEEERetirementBanner id={id} />
      ) : templateKey === 'notification_personal_and_group_subscriptions' ? (
        <Notification
          bsStyle="warning"
          onDismiss={() => id && handleDismiss(id)}
          body={
            <Trans
              i18nKey="notification_personal_and_group_subscriptions"
              /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
              components={[<strong />, <a href="/user/subscription" />]}
            />
          }
        />
      ) : (
        <Notification
          bsStyle="info"
          onDismiss={() => id && handleDismiss(id)}
          body={html}
        />
      )}
    </>
  )
}

export default Common
