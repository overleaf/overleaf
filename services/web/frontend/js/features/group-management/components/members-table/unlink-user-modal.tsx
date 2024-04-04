import { Modal } from 'react-bootstrap'
import AccessibleModal from '@/shared/components/accessible-modal'
import { useTranslation, Trans } from 'react-i18next'
import { User } from '../../../../../../types/group-management/user'
import getMeta from '@/utils/meta'
import { SetStateAction, useCallback, useState, type Dispatch } from 'react'
import useAsync from '@/shared/hooks/use-async'
import { postJSON } from '@/infrastructure/fetch-json'
import NotificationScrolledTo from '@/shared/components/notification-scrolled-to'
import { debugConsole } from '@/utils/debugging'
import { GroupUserAlert } from '../../utils/types'
import { useGroupMembersContext } from '../../context/group-members-context'

export type UnlinkUserModalProps = {
  onClose: () => void
  user: User
  setGroupUserAlert: Dispatch<SetStateAction<GroupUserAlert>>
}

export default function UnlinkUserModal({
  onClose,
  user,
  setGroupUserAlert,
}: UnlinkUserModalProps) {
  const { t } = useTranslation()
  const groupId = getMeta('ol-groupId')
  const [hasError, setHasError] = useState<string | undefined>()
  const { isLoading: unlinkInFlight, runAsync, reset } = useAsync()
  const { updateMemberView } = useGroupMembersContext()

  const setUserAsUnlinked = useCallback(() => {
    if (!user.enrollment?.sso) {
      return
    }
    const enrollment = Object.assign({}, user.enrollment, {
      sso: user.enrollment.sso.filter(sso => sso.groupId !== groupId),
    })
    const updatedUser = Object.assign({}, user, {
      enrollment,
    })
    updateMemberView(user._id, updatedUser)
  }, [groupId, updateMemberView, user])

  const handleUnlink = useCallback(
    event => {
      event.preventDefault()
      setHasError(undefined)
      if (!user) {
        setHasError(t('generic_something_went_wrong'))
        return
      }
      runAsync(postJSON(`/manage/groups/${groupId}/unlink-user/${user._id}`))
        .then(() => {
          setUserAsUnlinked()
          setGroupUserAlert({
            variant: 'unlinkedSSO',
            email: user.email,
          })
          onClose()
          reset()
        })
        .catch(e => {
          debugConsole.error(e)
          setHasError(t('generic_something_went_wrong'))
        })
    },
    [
      groupId,
      onClose,
      reset,
      runAsync,
      setGroupUserAlert,
      setUserAsUnlinked,
      t,
      user,
    ]
  )

  return (
    <AccessibleModal show onHide={onClose}>
      <Modal.Header>
        <Modal.Title>{t('unlink_user')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {hasError && (
          <div className="mb-3">
            <NotificationScrolledTo
              type="error"
              content={hasError}
              id="alert-unlink-user-error"
              ariaLive="polite"
            />
          </div>
        )}
        <p>
          <Trans
            i18nKey="unlink_user_explanation"
            components={[<strong />]} // eslint-disable-line react/jsx-key
            values={{ email: user.email }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
          />
        </p>
      </Modal.Body>
      <Modal.Footer>
        <button className="btn btn-secondary" disabled={unlinkInFlight}>
          {t('cancel')}
        </button>
        <button
          className="btn btn-danger"
          onClick={e => handleUnlink(e)}
          disabled={unlinkInFlight}
        >
          {t('unlink_user')}
        </button>
      </Modal.Footer>
    </AccessibleModal>
  )
}
