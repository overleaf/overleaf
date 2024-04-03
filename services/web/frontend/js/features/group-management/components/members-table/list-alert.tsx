import { type PropsWithChildren, useState } from 'react'
import { Alert, type AlertProps } from 'react-bootstrap'
import { Trans, useTranslation } from 'react-i18next'
import type { GroupUserAlertVariant } from '../../utils/types'
import NotificationScrolledTo from '@/shared/components/notification-scrolled-to'

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
    <AlertComponent bsStyle="success" onDismiss={onDismiss}>
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
    </AlertComponent>
  )
}

function ResendSSOLinkInviteSuccess({
  onDismiss,
  userEmail,
}: GroupUsersListAlertComponentProps) {
  return (
    <AlertComponent bsStyle="success" onDismiss={onDismiss}>
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
    </AlertComponent>
  )
}

function FailedToResendManagedInvite({
  onDismiss,
  userEmail,
}: GroupUsersListAlertComponentProps) {
  return (
    <AlertComponent bsStyle="danger" onDismiss={onDismiss}>
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
    </AlertComponent>
  )
}
function FailedToResendSSOLink({
  onDismiss,
  userEmail,
}: GroupUsersListAlertComponentProps) {
  return (
    <AlertComponent bsStyle="danger" onDismiss={onDismiss}>
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
    </AlertComponent>
  )
}

function ResendGroupInviteSuccess({
  onDismiss,
  userEmail,
}: GroupUsersListAlertComponentProps) {
  return (
    <AlertComponent bsStyle="success" onDismiss={onDismiss}>
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
    </AlertComponent>
  )
}

function FailedToResendGroupInvite({
  onDismiss,
  userEmail,
}: GroupUsersListAlertComponentProps) {
  return (
    <AlertComponent bsStyle="danger" onDismiss={onDismiss}>
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
    </AlertComponent>
  )
}

function TooManyRequests({
  onDismiss,
  userEmail,
}: GroupUsersListAlertComponentProps) {
  return (
    <AlertComponent bsStyle="danger" onDismiss={onDismiss}>
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
    </AlertComponent>
  )
}

type AlertComponentProps = PropsWithChildren<{
  bsStyle: AlertProps['bsStyle']
  onDismiss: AlertProps['onDismiss']
}>

function AlertComponent({ bsStyle, onDismiss, children }: AlertComponentProps) {
  const [show, setShow] = useState(true)
  const { t } = useTranslation()

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss()
    }

    setShow(false)
  }

  if (!show) {
    return null
  }

  return (
    <Alert bsStyle={bsStyle} className="managed-users-list-alert">
      <span>{children}</span>
      <div className="managed-users-list-alert-close">
        <button type="button" className="close" onClick={handleDismiss}>
          <span aria-hidden="true">&times;</span>
          <span className="sr-only">{t('close')}</span>
        </button>
      </div>
    </Alert>
  )
}
