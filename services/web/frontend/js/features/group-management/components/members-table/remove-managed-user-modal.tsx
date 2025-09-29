import { User } from '../../../../../../types/group-management/user'
import { useState } from 'react'
import useAsync from '@/shared/hooks/use-async'
import { useTranslation, Trans } from 'react-i18next'
import { useLocation } from '@/shared/hooks/use-location'
import { FetchError, postJSON } from '@/infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLButton from '@/shared/components/ol/ol-button'
import OLNotification from '@/shared/components/ol/ol-notification'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import { sendMB } from '@/infrastructure/event-tracking'

type RemoveManagedUserModalProps = {
  user: User
  groupId: string
  onClose: () => void
}

export default function RemoveManagedUserModal({
  user,
  groupId,
  onClose,
}: RemoveManagedUserModalProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const { isLoading, isSuccess, error, setError, runAsync } = useAsync<
    any,
    any
  >()
  const [suppliedEmail, setSuppliedEmail] = useState<string>()
  const shouldEnableRemoveUserButton = suppliedEmail === user.email
  const userFullName = user.last_name
    ? `${user.first_name || ''} ${user.last_name || ''}`
    : user.first_name

  const handleReleaseUserSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendMB('remove-managed-user-confirmed')
    runAsync(
      postJSON(`/manage/groups/${groupId}/release-managed-user/${user._id}`, {
        body: {
          verificationEmail: suppliedEmail,
        },
      })
        .then(() => {
          location.reload()
        })
        .catch(err => {
          setError(
            err instanceof FetchError ? err.getUserFacingMessage() : err.message
          )
          debugConsole.error(err)
        })
    )
  }

  return (
    <OLModal id={`release-user-modal-${user._id}`} show onHide={onClose}>
      <form onSubmit={handleReleaseUserSubmit} data-testid="release-user-form">
        <OLModalHeader>
          <OLModalTitle>{t('remove_user')}</OLModalTitle>
        </OLModalHeader>
        <OLModalBody>
          <p>
            {t('about_to_remove_user_preamble', {
              userName: userFullName,
              userEmail: user.email,
            })}
          </p>
          <ul>
            <li>{t('they_will_be_removed_from_the_group')}</li>
            <li>{t('they_will_no_longer_be_a_managed_user')}</li>
            <li>
              {t('they_will_retain_their_existing_account_on_the_free_plan')}
            </li>
            <li>
              {t(
                'they_will_retain_ownership_of_projects_currently_owned_by_them_and_collaborators_will_become_read_only'
              )}
            </li>
            <li>
              {t(
                'they_will_continue_to_have_access_to_any_projects_shared_with_them'
              )}
            </li>
            <li>
              {t(
                'they_wont_be_able_to_log_in_with_sso_they_will_need_to_set_password'
              )}
            </li>
          </ul>
          <p>
            <Trans
              i18nKey="user_has_left_organization_and_need_to_transfer_their_projects"
              components={[<b />]} // eslint-disable-line react/jsx-key
            />
          </p>
          <OLFormGroup controlId="supplied-email-input">
            <OLFormLabel>
              {t('confirm_remove_user_type_email_address', {
                userName: userFullName,
              })}
            </OLFormLabel>
            <OLFormControl
              type="email"
              aria-label={t('email')}
              onChange={e => setSuppliedEmail(e.target.value)}
            />
          </OLFormGroup>
          {error && (
            <OLNotification type="error" content={error} className="mb-0" />
          )}
        </OLModalBody>
        <OLModalFooter>
          <OLButton variant="secondary" onClick={onClose}>
            {t('cancel')}
          </OLButton>
          <OLButton
            type="submit"
            variant="danger"
            disabled={isLoading || isSuccess || !shouldEnableRemoveUserButton}
            isLoading={isLoading}
            loadingLabel={t('removing')}
          >
            {t('remove_user')}
          </OLButton>
        </OLModalFooter>
      </form>
    </OLModal>
  )
}
