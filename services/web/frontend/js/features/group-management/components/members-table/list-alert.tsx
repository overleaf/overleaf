import { Trans } from 'react-i18next'
import type { GroupUserAlertVariant } from '../../utils/types'
import NotificationScrolledTo from '@/shared/components/notification-scrolled-to'
import OLNotification from '@/shared/components/ol/ol-notification'

type GroupUsersListAlertProps = {
  variant: GroupUserAlertVariant
  userEmail?: string
  onDismiss: () => void
}

export default function ListAlert({
  variant,
  userEmail,
  onDismiss,
}: GroupUsersListAlertProps) {
  switch (variant) {
    case 'resendManagedUserInviteSuccess':
      return (
        <ResendManagedUserInviteSuccess
          onDismiss={onDismiss}
          userEmail={userEmail}
        />
      )
    case 'resendSSOLinkInviteSuccess':
      return (
        <ResendSSOLinkInviteSuccess
          onDismiss={onDismiss}
          userEmail={userEmail}
        />
      )
    case 'resendManagedUserInviteFailed':
      return (
        <FailedToResendManagedInvite
          onDismiss={onDismiss}
          userEmail={userEmail}
        />
      )
    case 'resendSSOLinkInviteFailed':
      return (
        <FailedToResendSSOLink onDismiss={onDismiss} userEmail={userEmail} />
      )
    case 'resendGroupInviteSuccess':
      return (
        <ResendGroupInviteSuccess onDismiss={onDismiss} userEmail={userEmail} />
      )
    case 'resendGroupInviteFailed':
      return (
        <FailedToResendGroupInvite
          onDismiss={onDismiss}
          userEmail={userEmail}
        />
      )
    case 'resendInviteTooManyRequests':
      return <TooManyRequests onDismiss={onDismiss} userEmail={userEmail} />
    case 'unlinkedSSO':
      return (
        <NotificationScrolledTo
          type="success"
          content={
            <Trans
              i18nKey="sso_reauth_request"
              values={{ email: userEmail }}
              components={[<strong />]} // eslint-disable-line react/jsx-key
              shouldUnescape
              tOptions={{ interpolation: { escapeValue: true } }}
            />
          }
          id="sso-user-unlinked"
          ariaLive="polite"
          isDismissible
          onDismiss={onDismiss}
        />
      )
  }
}

type GroupUsersListAlertComponentProps = {
  onDismiss: () => void
  userEmail?: string
}

function ResendManagedUserInviteSuccess({
  onDismiss,
  userEmail,
}: GroupUsersListAlertComponentProps) {
  return (
    <OLNotification
      type="success"
      content={
        <Trans
          i18nKey="managed_user_invite_has_been_sent_to_email"
          values={{
            email: userEmail,
          }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          components={[
            // eslint-disable-next-line react/jsx-key
            <strong />,
          ]}
        />
      }
      isDismissible
      onDismiss={onDismiss}
    />
  )
}

function ResendSSOLinkInviteSuccess({
  onDismiss,
  userEmail,
}: GroupUsersListAlertComponentProps) {
  return (
    <OLNotification
      type="success"
      content={
        <Trans
          i18nKey="sso_link_invite_has_been_sent_to_email"
          values={{
            email: userEmail,
          }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          components={[
            // eslint-disable-next-line react/jsx-key
            <strong />,
          ]}
        />
      }
      isDismissible
      onDismiss={onDismiss}
    />
  )
}

function FailedToResendManagedInvite({
  onDismiss,
  userEmail,
}: GroupUsersListAlertComponentProps) {
  return (
    <OLNotification
      type="error"
      content={
        <Trans
          i18nKey="failed_to_send_managed_user_invite_to_email"
          values={{
            email: userEmail,
          }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          components={[
            // eslint-disable-next-line react/jsx-key
            <strong />,
          ]}
        />
      }
      isDismissible
      onDismiss={onDismiss}
    />
  )
}
function FailedToResendSSOLink({
  onDismiss,
  userEmail,
}: GroupUsersListAlertComponentProps) {
  return (
    <OLNotification
      type="error"
      content={
        <Trans
          i18nKey="failed_to_send_sso_link_invite_to_email"
          values={{
            email: userEmail,
          }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          components={[
            // eslint-disable-next-line react/jsx-key
            <strong />,
          ]}
        />
      }
      isDismissible
      onDismiss={onDismiss}
    />
  )
}

function ResendGroupInviteSuccess({
  onDismiss,
  userEmail,
}: GroupUsersListAlertComponentProps) {
  return (
    <OLNotification
      type="success"
      content={
        <Trans
          i18nKey="group_invite_has_been_sent_to_email"
          values={{
            email: userEmail,
          }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          components={[
            // eslint-disable-next-line react/jsx-key
            <strong />,
          ]}
        />
      }
      isDismissible
      onDismiss={onDismiss}
    />
  )
}

function FailedToResendGroupInvite({
  onDismiss,
  userEmail,
}: GroupUsersListAlertComponentProps) {
  return (
    <OLNotification
      type="error"
      content={
        <Trans
          i18nKey="failed_to_send_group_invite_to_email"
          values={{
            email: userEmail,
          }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          components={[
            // eslint-disable-next-line react/jsx-key
            <strong />,
          ]}
        />
      }
      isDismissible
      onDismiss={onDismiss}
    />
  )
}

function TooManyRequests({
  onDismiss,
  userEmail,
}: GroupUsersListAlertComponentProps) {
  return (
    <OLNotification
      type="error"
      content={
        <Trans
          i18nKey="an_email_has_already_been_sent_to"
          values={{
            email: userEmail,
          }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          components={[
            // eslint-disable-next-line react/jsx-key
            <strong />,
          ]}
        />
      }
      isDismissible
      onDismiss={onDismiss}
    />
  )
}
