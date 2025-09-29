import { User } from '../../../../../../types/group-management/user'
import { useState } from 'react'
import useAsync from '@/shared/hooks/use-async'
import { useTranslation } from 'react-i18next'
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
import OLFormSelect from '@/shared/components/ol/ol-form-select'
import { sendMB } from '@/infrastructure/event-tracking'

type OffboardManagedUserModalProps = {
  user: User
  allMembers: User[]
  groupId: string
  onClose: () => void
}

export default function OffboardManagedUserModal({
  user,
  allMembers,
  groupId,
  onClose,
}: OffboardManagedUserModalProps) {
  const { t } = useTranslation()
  const location = useLocation()

  const [selectedRecipientId, setSelectedRecipientId] = useState<string>()
  const [suppliedEmail, setSuppliedEmail] = useState<string>()
  const [error, setError] = useState<string>()

  const { isLoading, isSuccess, runAsync } = useAsync()

  const otherMembers = allMembers.filter(u => u._id !== user._id && !u.invite)
  const userFullName = user.last_name
    ? `${user.first_name || ''} ${user.last_name || ''}`
    : user.first_name

  const shouldEnableDeleteUserButton =
    suppliedEmail === user.email && !!selectedRecipientId

  const handleDeleteUserSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendMB('delete-managed-user-confirmed')
    runAsync(
      postJSON(`/manage/groups/${groupId}/offboardManagedUser/${user._id}`, {
        body: {
          verificationEmail: suppliedEmail,
          transferProjectsToUserId: selectedRecipientId,
        },
      })
        .then(() => {
          location.reload()
        })
        .catch(err => {
          debugConsole.error(err)
          setError(
            err instanceof FetchError ? err.getUserFacingMessage() : err.message
          )
        })
    )
  }

  return (
    <OLModal id={`delete-user-modal-${user._id}`} show onHide={onClose}>
      <form id="delete-user-form" onSubmit={handleDeleteUserSubmit}>
        <OLModalHeader>
          <OLModalTitle>{t('delete_user')}</OLModalTitle>
        </OLModalHeader>
        <OLModalBody>
          <p>
            {t('about_to_delete_user_preamble', {
              userName: userFullName,
              userEmail: user.email,
            })}
          </p>
          <ul>
            <li>{t('they_lose_access_to_account')}</li>
            <li>{t('their_projects_will_be_transferred_to_another_user')}</li>
            <li>{t('you_will_be_able_to_reassign_subscription')}</li>
          </ul>
          <p>
            <span>{t('this_action_cannot_be_reversed')}</span>
            &nbsp;
            <a href="/learn/how-to/User_Management_in_Overleaf" target="_blank">
              {t('learn_more_about_managed_users')}
            </a>
          </p>
          <strong>{t('transfer_this_users_projects')}</strong>
          <p>{t('transfer_this_users_projects_description')}</p>
          <OLFormGroup controlId="recipient-select-input">
            <OLFormLabel>{t('select_a_new_owner_for_projects')}</OLFormLabel>
            <OLFormSelect
              aria-label={t('select_user')}
              required
              value={selectedRecipientId || ''}
              onChange={e => setSelectedRecipientId(e.target.value)}
            >
              <option hidden disabled value="">
                {t('choose_from_group_members')}
              </option>
              {otherMembers.map(member => (
                <option value={member._id} key={member.email}>
                  {member.email}
                </option>
              ))}
            </OLFormSelect>
          </OLFormGroup>
          <p>
            <span>{t('all_projects_will_be_transferred_immediately')}</span>
          </p>
          <OLFormGroup controlId="supplied-email-input">
            <OLFormLabel>
              {t('confirm_delete_user_type_email_address', {
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
            disabled={isLoading || isSuccess || !shouldEnableDeleteUserButton}
            loadingLabel={t('deleting')}
            isLoading={isLoading}
          >
            {t('delete_user')}
          </OLButton>
        </OLModalFooter>
      </form>
    </OLModal>
  )
}
