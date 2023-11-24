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
import useAsync from '@/shared/hooks/use-async'
import { type FetchError, postJSON } from '@/infrastructure/fetch-json'
import Icon from '@/shared/components/icon'
import { ManagedUserAlert } from '../../utils/types'
import { useGroupMembersContext } from '../../context/group-members-context'
import getMeta from '@/utils/meta'

type resendInviteResponse = {
  success: boolean
}

type ManagedUserDropdownButtonProps = {
  user: User
  openOffboardingModalForUser: (user: User) => void
  groupId: string
  setManagedUserAlert: Dispatch<SetStateAction<ManagedUserAlert>>
}

export default function DropdownButton({
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
    runAsync: runResendLinkSSOInviteAsync,
    isLoading: isResendingSSOLinkInvite,
  } = useAsync<resendInviteResponse>()
  const {
    runAsync: runResendGroupInviteAsync,
    isLoading: isResendingGroupInvite,
  } = useAsync<resendInviteResponse>()

  const managedUsersActive = getMeta('ol-managedUsersActive')
  const groupSSOActive = getMeta('ol-groupSSOActive')

  const userPending = user.invite
  const isGroupSSOLinked =
    !userPending && user.enrollment?.sso?.some(sso => sso.groupId === groupId)
  const isUserManaged = !userPending && user.enrollment?.managedBy === groupId

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

  const handleResendLinkSSOInviteAsync = useCallback(
    async user => {
      try {
        const result = await runResendLinkSSOInviteAsync(
          postJSON(`/manage/groups/${groupId}/resendSSOLinkInvite/${user._id}`)
        )

        if (result.success) {
          setManagedUserAlert({
            variant: 'resendSSOLinkInviteSuccess',
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
            variant: 'resendSSOLinkInviteFailed',
            email: user.email,
          })
        }

        setIsOpened(false)
      }
    },
    [setManagedUserAlert, groupId, runResendLinkSSOInviteAsync]
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
  const onResendSSOLinkInviteClick = () => {
    handleResendLinkSSOInviteAsync(user)
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

  const buttons = []

  if (userPending) {
    buttons.push(
      <MenuItemButton
        onClick={onResendGroupInviteClick}
        key="resend-group-invite-action"
        data-testid="resend-group-invite-action"
      >
        {t('resend_group_invite')}
        {isResendingGroupInvite ? (
          <Icon type="spinner" spin style={{ marginLeft: '5px' }} />
        ) : null}
      </MenuItemButton>
    )
  }
  if (managedUsersActive && !isUserManaged && !userPending) {
    buttons.push(
      <MenuItemButton
        onClick={onResendManagedUserInviteClick}
        key="resend-managed-user-invite-action"
        data-testid="resend-managed-user-invite-action"
      >
        {t('resend_managed_user_invite')}
        {isResendingManagedUserInvite ? (
          <Icon type="spinner" spin style={{ marginLeft: '5px' }} />
        ) : null}
      </MenuItemButton>
    )
  }
  if (groupSSOActive && !isGroupSSOLinked && !userPending) {
    buttons.push(
      <MenuItemButton
        onClick={onResendSSOLinkInviteClick}
        key="resend-sso-link-invite-action"
        data-testid="resend-sso-link-invite-action"
      >
        {t('resend_link_sso')}
        {isResendingSSOLinkInvite ? (
          <Icon type="spinner" spin style={{ marginLeft: '5px' }} />
        ) : null}
      </MenuItemButton>
    )
  }
  if (isUserManaged && !user.isEntityAdmin) {
    buttons.push(
      <MenuItemButton
        className="delete-user-action"
        key="delete-user-action"
        data-testid="delete-user-action"
        onClick={onDeleteUserClick}
      >
        {t('delete_user')}
      </MenuItemButton>
    )
  } else if (!isUserManaged) {
    buttons.push(
      <MenuItemButton
        key="remove-user-action"
        data-testid="remove-user-action"
        onClick={onRemoveFromGroup}
        className="delete-user-action"
      >
        {t('remove_from_group')}
      </MenuItemButton>
    )
  }

  if (buttons.length === 0) {
    buttons.push(
      <MenuItem key="no-actions-available" data-testid="no-actions-available">
        <span className="text-muted">{t('no_actions')}</span>
      </MenuItem>
    )
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
          {buttons}
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
