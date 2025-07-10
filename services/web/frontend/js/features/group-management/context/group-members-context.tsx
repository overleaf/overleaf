import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { User } from '../../../../../types/group-management/user'
import { deleteJSON, FetchError, postJSON } from '@/infrastructure/fetch-json'
import { mapSeries } from '@/infrastructure/promise'
import getMeta from '@/utils/meta'
import { APIError } from '../components/error-alert'
import useUserSelection from '../hooks/use-user-selection'
import { parseEmails } from '../utils/emails'
import { debugConsole } from '@/utils/debugging'

export type GroupMembersContextValue = {
  users: User[]
  selectedUsers: User[]
  selectUser: (user: User) => void
  selectAllUsers: () => void
  unselectAllUsers: () => void
  selectAllNonManagedUsers: () => void
  unselectUser: (user: User) => void
  addMembers: (emailString: string) => void
  removeMembers: (e: any) => void
  removeMember: (user: User) => Promise<void>
  removeMemberLoading: boolean
  removeMemberError?: APIError
  updateMemberView: (userId: string, updatedUser: User) => void
  inviteMemberLoading: boolean
  inviteError?: APIError
  memberAdded: boolean
  paths: { [key: string]: string }
}

export const GroupMembersContext = createContext<
  GroupMembersContextValue | undefined
>(undefined)

type GroupMembersProviderProps = {
  children: ReactNode
}

export function GroupMembersProvider({ children }: GroupMembersProviderProps) {
  const {
    users,
    setUsers,
    selectedUsers,
    selectAllUsers,
    unselectAllUsers,
    selectAllNonManagedUsers,
    selectUser,
    unselectUser,
  } = useUserSelection(getMeta('ol-users') || [])

  const [inviteUserInflightCount, setInviteUserInflightCount] = useState(0)
  const [inviteError, setInviteError] = useState<APIError>()
  const [removeMemberInflightCount, setRemoveMemberInflightCount] = useState(0)
  const [removeMemberError, setRemoveMemberError] = useState<APIError>()
  const [memberAdded, setMemberAdded] = useState(false)

  const groupId = getMeta('ol-groupId')

  const paths = useMemo(
    () => ({
      addMember: `/manage/groups/${groupId}/invites`,
      removeMember: `/manage/groups/${groupId}/user`,
      removeInvite: `/manage/groups/${groupId}/invites`,
      exportMembers: `/manage/groups/${groupId}/members/export`,
    }),
    [groupId]
  )

  const addMembers = useCallback(
    (emailString: string) => {
      setInviteError(undefined)
      setMemberAdded(false)
      const emails = parseEmails(emailString)
      let isError = false
      mapSeries(emails, async email => {
        setInviteUserInflightCount(count => count + 1)
        try {
          const data = await postJSON<{ user: User }>(paths.addMember, {
            body: {
              email,
            },
          })
          if (data.user) {
            const alreadyListed = users.find(
              user => user.email === data.user.email
            )
            if (!alreadyListed) {
              setUsers(users => [...users, data.user])
            }
          }
        } catch (error: unknown) {
          debugConsole.error(error)
          setInviteError((error as FetchError)?.data?.error || {})
          isError = true
        }
        setInviteUserInflightCount(count => {
          const newCount = count - 1
          if (newCount === 0 && !isError) {
            setMemberAdded(true)
          }
          return newCount
        })
      })
    },
    [paths.addMember, users, setUsers]
  )

  const removeMember = useCallback(
    async (user: User) => {
      let url
      if (paths.removeInvite && user.invite && user._id == null) {
        url = `${paths.removeInvite}/${encodeURIComponent(user.email)}`
      } else if (paths.removeMember && user._id) {
        url = `${paths.removeMember}/${user._id}`
      } else {
        return
      }
      setRemoveMemberInflightCount(count => count + 1)
      try {
        await deleteJSON(url, {})
        setUsers(users => users.filter(u => u !== user))
        unselectUser(user)
      } catch (error: unknown) {
        debugConsole.error(error)
        setRemoveMemberError((error as FetchError)?.data?.error || {})
      }
      setRemoveMemberInflightCount(count => count - 1)
    },
    [unselectUser, setUsers, paths.removeInvite, paths.removeMember]
  )

  const removeMembers = useCallback(
    (e: any) => {
      e.preventDefault()
      setRemoveMemberError(undefined)
      ;(async () => {
        for (const user of selectedUsers) {
          if (user?.enrollment?.managedBy) {
            continue
          }
          await removeMember(user)
        }
      })()
    },
    [selectedUsers, removeMember]
  )

  const updateMemberView = useCallback(
    (userId: string, updatedUser: User) => {
      setUsers(
        users.map(u => {
          if (u._id === userId) {
            return updatedUser
          } else {
            return u
          }
        })
      )
    },
    [setUsers, users]
  )

  const value = useMemo<GroupMembersContextValue>(
    () => ({
      users,
      selectedUsers,
      selectAllUsers,
      unselectAllUsers,
      selectAllNonManagedUsers,
      selectUser,
      unselectUser,
      updateMemberView,
      addMembers,
      removeMembers,
      removeMember,
      removeMemberLoading: removeMemberInflightCount > 0,
      removeMemberError,
      inviteMemberLoading: inviteUserInflightCount > 0,
      inviteError,
      memberAdded,
      paths,
    }),
    [
      users,
      selectedUsers,
      selectAllUsers,
      unselectAllUsers,
      selectAllNonManagedUsers,
      selectUser,
      unselectUser,
      updateMemberView,
      addMembers,
      removeMembers,
      removeMember,
      removeMemberInflightCount,
      removeMemberError,
      inviteUserInflightCount,
      inviteError,
      memberAdded,
      paths,
    ]
  )

  return (
    <GroupMembersContext.Provider value={value}>
      {children}
    </GroupMembersContext.Provider>
  )
}

export function useGroupMembersContext() {
  const context = useContext(GroupMembersContext)
  if (!context) {
    throw new Error(
      'GroupMembersContext is only available inside GroupMembersProvider'
    )
  }
  return context
}
