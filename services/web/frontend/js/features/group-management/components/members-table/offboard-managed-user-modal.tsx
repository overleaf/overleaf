import { User } from '../../../../../../types/group-management/user'
import {
  Alert,
  Button,
  ControlLabel,
  Form,
  FormControl,
  FormGroup,
  Modal,
} from 'react-bootstrap'
import AccessibleModal from '@/shared/components/accessible-modal'
import Icon from '@/shared/components/icon'
import { useState } from 'react'
import useAsync from '@/shared/hooks/use-async'
import { useTranslation } from 'react-i18next'
import { useLocation } from '@/shared/hooks/use-location'
import { FetchError, postJSON } from '@/infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'

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

  const handleDeleteUserSubmit = (event: any) => {
    event.preventDefault()
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
    <AccessibleModal id={`delete-user-modal-${user._id}`} show onHide={onClose}>
      <Form id="delete-user-form" onSubmit={handleDeleteUserSubmit}>
        <Modal.Header>
          <Modal.Title>{t('delete_user')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
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
          <FormGroup>
            <ControlLabel htmlFor="recipient-select-input">
              {t('select_a_new_owner_for_projects')}
            </ControlLabel>
            <FormControl
              id="recipient-select-input"
              className="form-control"
              componentClass="select"
              aria-label={t('select_user')}
              required
              placeholder={t('choose_from_group_members')}
              value={selectedRecipientId || ''}
              onChange={(e: React.ChangeEvent<HTMLFormElement & FormControl>) =>
                setSelectedRecipientId(e.target.value)
              }
            >
              <option hidden disabled value="">
                {t('choose_from_group_members')}
              </option>
              {otherMembers.map(member => (
                <option value={member._id} key={member.email}>
                  {member.email}
                </option>
              ))}
            </FormControl>
          </FormGroup>
          <p>
            <span>{t('all_projects_will_be_transferred_immediately')}</span>
          </p>
          <FormGroup>
            <ControlLabel htmlFor="supplied-email-input">
              {t('confirm_delete_user_type_email_address', {
                userName: userFullName,
              })}
            </ControlLabel>
            <FormControl
              id="supplied-email-input"
              type="email"
              aria-label={t('email')}
              onChange={(e: React.ChangeEvent<HTMLFormElement & FormControl>) =>
                setSuppliedEmail(e.target.value)
              }
            />
          </FormGroup>
          {error && <Alert bsStyle="danger">{error}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <FormGroup>
            <Button onClick={onClose}>{t('cancel')}</Button>
            <Button
              type="submit"
              bsStyle="danger"
              disabled={isLoading || isSuccess || !shouldEnableDeleteUserButton}
            >
              {isLoading ? (
                <>
                  <Icon type="refresh" fw spin /> {t('deleting')}…
                </>
              ) : (
                t('delete_user')
              )}
            </Button>
          </FormGroup>
        </Modal.Footer>
      </Form>
    </AccessibleModal>
  )
}
