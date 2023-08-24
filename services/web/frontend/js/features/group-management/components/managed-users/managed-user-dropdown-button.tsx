import {
  useState,
  type ComponentProps,
  useCallback,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Dropdown, MenuItem } from 'react-bootstrap'
import { User } from '../../../../../../types/group-management/user'
import useAsync from '../../../../shared/hooks/use-async'
import {
  type FetchError,
  postJSON,
} from '../../../../infrastructure/fetch-json'
import Icon from '../../../../shared/components/icon'
import { ManagedUserAlert } from '../../utils/types'
import { useGroupMembersContext } from '../../context/group-members-context'

type resendInviteResponse = {
  success: boolean
}

type ManagedUserDropdownButtonProps = {
  user: User
  openOffboardingModalForUser: (user: User) => void
  groupId: string
  setManagedUserAlert: Dispatch<SetStateAction<ManagedUserAlert>>
}

export default function ManagedUserDropdownButton({
  user,
  openOffboardingModalForUser,
  groupId,
  setManagedUserAlert,
}: ManagedUserDropdownButtonProps) {
  const { t } = useTranslation()
  const { removeMember } = useGroupMembersContext()
  const [isOpened, setIsOpened] = useState(false)
  const {
    runAsync: runResendManagedUserInviteAsync,
    isLoading: isResendingManagedUserInvite,
  } = useAsync<resendInviteResponse>()

  const {
    runAsync: runResendGroupInviteAsync,
    isLoading: isResendingGroupInvite,
  } = useAsync<resendInviteResponse>()

  const userNotManaged =
    !user.isEntityAdmin && !user.invite && !user.enrollment?.managedBy

  const userPending = user.invite

  const handleResendManagedUserInvite = useCallback(
    async user => {
      try {
        const result = await runResendManagedUserInviteAsync(
          postJSON(
            `/manage/groups/${groupId}/resendManagedUserInvite/${user._id}`
          )
        )

        if (result.success) {
          setManagedUserAlert({
            variant: 'resendManagedUserInviteSuccess',
            email: user.email,
          })
          setIsOpened(false)
        }
      } catch (err) {
        if ((err as FetchError)?.response?.status === 429) {
          setManagedUserAlert({
            variant: 'resendInviteTooManyRequests',
            email: user.email,
          })
        } else {
          setManagedUserAlert({
            variant: 'resendManagedUserInviteFailed',
            email: user.email,
          })
        }

        setIsOpened(false)
      }
    },
    [setManagedUserAlert, groupId, runResendManagedUserInviteAsync]
  )

  const handleResendGroupInvite = useCallback(
    async user => {
      try {
        await runResendGroupInviteAsync(
          postJSON(`/manage/groups/${groupId}/resendInvite/`, {
            body: {
              email: user.email,
            },
          })
        )

        setManagedUserAlert({
          variant: 'resendGroupInviteSuccess',
          email: user.email,
        })
        setIsOpened(false)
      } catch (err) {
        if ((err as FetchError)?.response?.status === 429) {
          setManagedUserAlert({
            variant: 'resendInviteTooManyRequests',
            email: user.email,
          })
        } else {
          setManagedUserAlert({
            variant: 'resendGroupInviteFailed',
            email: user.email,
          })
        }

        setIsOpened(false)
      }
    },
    [setManagedUserAlert, groupId, runResendGroupInviteAsync]
  )

  const onResendManagedUserInviteClick = () => {
    handleResendManagedUserInvite(user)
  }

  const onResendGroupInviteClick = () => {
    handleResendGroupInvite(user)
  }

  const onDeleteUserClick = () => {
    openOffboardingModalForUser(user)
  }

  const onRemoveFromGroup = () => {
    removeMember(user)
  }

  return (
    <span className="managed-user-actions">
      <Dropdown
        id={`managed-user-dropdown-${user.email}`}
        open={isOpened}
        onToggle={open => setIsOpened(open)}
      >
        <Dropdown.Toggle
          bsStyle={null}
          className="btn btn-link action-btn"
          noCaret
        >
          <i
            className="fa fa-ellipsis-v"
            aria-hidden="true"
            aria-label={t('actions')}
          />
        </Dropdown.Toggle>
        <Dropdown.Menu className="dropdown-menu-right managed-user-dropdown-menu">
          {userPending ? (
            <MenuItemButton onClick={onResendGroupInviteClick}>
              {t('resend_group_invite')}
              {isResendingGroupInvite ? (
                <Icon type="spinner" spin style={{ marginLeft: '5px' }} />
              ) : null}
            </MenuItemButton>
          ) : null}
          {userNotManaged ? (
            <MenuItemButton onClick={onResendManagedUserInviteClick}>
              {t('resend_managed_user_invite')}
              {isResendingManagedUserInvite ? (
                <Icon type="spinner" spin style={{ marginLeft: '5px' }} />
              ) : null}
            </MenuItemButton>
          ) : null}
          {user.enrollment?.managedBy ? (
            <MenuItemButton
              className="delete-user-action"
              data-testid="delete-user-action"
              onClick={onDeleteUserClick}
            >
              {t('delete_user')}
            </MenuItemButton>
          ) : user.isEntityAdmin ? (
            <MenuItem data-testid="no-actions-available">
              <span className="text-muted">{t('no_actions')}</span>
            </MenuItem>
          ) : (
            <MenuItemButton
              onClick={onRemoveFromGroup}
              className="delete-user-action"
              data-testid="remove-user-action"
            >
              {t('remove_from_group')}
            </MenuItemButton>
          )}
        </Dropdown.Menu>
      </Dropdown>
    </span>
  )
}

function MenuItemButton({
  children,
  onClick,
  className,
  ...buttonProps
}: ComponentProps<'button'>) {
  return (
    <li role="presentation" className={className}>
      <button
        className="managed-user-menu-item-button"
        role="menuitem"
        onClick={onClick}
        {...buttonProps}
      >
        {children}
      </button>
    </li>
  )
}
