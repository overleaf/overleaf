import { type PropsWithChildren, useState } from 'react'
import { Alert, type AlertProps } from 'react-bootstrap'
import { Trans, useTranslation } from 'react-i18next'
import type { ManagedUserAlertVariant } from '../../utils/types'

type ManagedUsersListAlertProps = {
  variant: ManagedUserAlertVariant
  invitedUserEmail?: string
  onDismiss: () => void
}

export default function ListAlert({
  variant,
  invitedUserEmail,
  onDismiss,
}: ManagedUsersListAlertProps) {
  switch (variant) {
    case 'resendManagedUserInviteSuccess':
      return (
        <ResendManagedUserInviteSuccess
          onDismiss={onDismiss}
          invitedUserEmail={invitedUserEmail}
        />
      )
    case 'resendSSOLinkInviteSuccess':
      return (
        <ResendSSOLinkInviteSuccess
          onDismiss={onDismiss}
          invitedUserEmail={invitedUserEmail}
        />
      )
    case 'resendManagedUserInviteFailed':
      return (
        <FailedToResendManagedInvite
          onDismiss={onDismiss}
          invitedUserEmail={invitedUserEmail}
        />
      )
    case 'resendSSOLinkInviteFailed':
      return (
        <FailedToResendSSOLink
          onDismiss={onDismiss}
          invitedUserEmail={invitedUserEmail}
        />
      )
    case 'resendGroupInviteSuccess':
      return (
        <ResendGroupInviteSuccess
          onDismiss={onDismiss}
          invitedUserEmail={invitedUserEmail}
        />
      )
    case 'resendGroupInviteFailed':
      return (
        <FailedToResendGroupInvite
          onDismiss={onDismiss}
          invitedUserEmail={invitedUserEmail}
        />
      )
    case 'resendInviteTooManyRequests':
      return (
        <TooManyRequests
          onDismiss={onDismiss}
          invitedUserEmail={invitedUserEmail}
        />
      )
  }
}

type ManagedUsersListAlertComponentProps = {
  onDismiss: () => void
  invitedUserEmail?: string
}

function ResendManagedUserInviteSuccess({
  onDismiss,
  invitedUserEmail,
}: ManagedUsersListAlertComponentProps) {
  return (
    <AlertComponent bsStyle="success" onDismiss={onDismiss}>
      <Trans
        i18nKey="managed_user_invite_has_been_sent_to_email"
        values={{
          email: invitedUserEmail,
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
  invitedUserEmail,
}: ManagedUsersListAlertComponentProps) {
  return (
    <AlertComponent bsStyle="success" onDismiss={onDismiss}>
      <Trans
        i18nKey="sso_link_invite_has_been_sent_to_email"
        values={{
          email: invitedUserEmail,
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
  invitedUserEmail,
}: ManagedUsersListAlertComponentProps) {
  return (
    <AlertComponent bsStyle="danger" onDismiss={onDismiss}>
      <Trans
        i18nKey="failed_to_send_managed_user_invite_to_email"
        values={{
          email: invitedUserEmail,
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
  invitedUserEmail,
}: ManagedUsersListAlertComponentProps) {
  return (
    <AlertComponent bsStyle="danger" onDismiss={onDismiss}>
      <Trans
        i18nKey="failed_to_send_sso_link_invite_to_email"
        values={{
          email: invitedUserEmail,
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
  invitedUserEmail,
}: ManagedUsersListAlertComponentProps) {
  return (
    <AlertComponent bsStyle="success" onDismiss={onDismiss}>
      <Trans
        i18nKey="group_invite_has_been_sent_to_email"
        values={{
          email: invitedUserEmail,
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
  invitedUserEmail,
}: ManagedUsersListAlertComponentProps) {
  return (
    <AlertComponent bsStyle="danger" onDismiss={onDismiss}>
      <Trans
        i18nKey="failed_to_send_group_invite_to_email"
        values={{
          email: invitedUserEmail,
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
  invitedUserEmail,
}: ManagedUsersListAlertComponentProps) {
  return (
    <AlertComponent bsStyle="danger" onDismiss={onDismiss}>
      <Trans
        i18nKey="an_email_has_already_been_sent_to"
        values={{
          email: invitedUserEmail,
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
