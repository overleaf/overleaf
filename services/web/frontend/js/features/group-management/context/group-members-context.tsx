import {
  Dispatch,
  ReactNode,
  SetStateAction,
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
  setSelectedUsers: Dispatch<SetStateAction<User[]>>
  selectUser: (user: User) => void
  selectAllUsers: () => void
  unselectAllUsers: () => void
  selectAllNonManagedUsers: () => void
  unselectUser: (user: User) => void
  addMembers: (emailString: string) => void
  removeMembers: (e: any, keepUsers?: boolean) => void
  removeMember: (user: User, keepUser?: boolean) => Promise<void>
  removeMemberLoading: boolean
  removeMemberError?: APIError
  updateMemberView: (userId: string, updatedUser: User) => void
  inviteMemberLoading: boolean
  inviteError?: APIError
  addManager: (email: string) => Promise<void>
  removeManager: (user: User, keepUser?: boolean) => Promise<void>
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
    setSelectedUsers,
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
  const [addManagerError, setAddManagerError] = useState<APIError>()
  const [removeManagerError, setRemoveManagerError] = useState<APIError>()
  const [memberAdded, setMemberAdded] = useState(false)

  const groupId = getMeta('ol-groupId')

  const paths = useMemo(
    () => ({
      addMember: `/manage/groups/${groupId}/invites`,
      removeMember: `/manage/groups/${groupId}/user`,
      removeInvite: `/manage/groups/${groupId}/invites`,
      exportMembers: `/manage/groups/${groupId}/members/export`,
      addManager: `/manage/groups/${groupId}/managers`,
      removeManager: `/manage/groups/${groupId}/managers`,
    }),
    [groupId]
  )

  const updateMemberView = useCallback(
    (userId: string, updatedUser: User) => {
      setUsers(users =>
        users.map(u => {
          if (u._id === userId) {
            return updatedUser
          } else {
            return u
          }
        })
      )
    },
    [setUsers]
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
            } else {
              updateMemberView(alreadyListed._id, {
                ...alreadyListed,
                invite: true,
              })
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
    [paths.addMember, users, setUsers, updateMemberView]
  )

  const removeMember = useCallback(
    async (user: User, keepUser = false) => {
      let url
      if (paths.removeInvite && user.invite && user._id === null) {
        url = `${paths.removeInvite}/${encodeURIComponent(user.email)}`
      } else if (paths.removeMember && user._id) {
        url = `${paths.removeMember}/${user._id}`
      } else {
        return
      }
      setRemoveMemberInflightCount(count => count + 1)
      try {
        await deleteJSON(url, {})
        if (!keepUser) {
          setUsers(users => users.filter(u => u !== user))
        } else {
          updateMemberView(user._id, {
            ...user,
            invite: false,
            isEntityMember: false,
            enrollment: {},
          })
        }
        unselectUser(user)
      } catch (error: unknown) {
        debugConsole.error(error)
        setRemoveMemberError((error as FetchError)?.data?.error || {})
      }
      setRemoveMemberInflightCount(count => count - 1)
    },
    [
      unselectUser,
      setUsers,
      paths.removeInvite,
      paths.removeMember,
      updateMemberView,
    ]
  )

  const removeMembers = useCallback(
    (e: any, keepUsers = false) => {
      e.preventDefault()
      setRemoveMemberError(undefined)
      ;(async () => {
        for (const user of selectedUsers) {
          if (user?.enrollment?.managedBy) {
            continue
          }
          await removeMember(user, keepUsers)
        }
      })()
    },
    [selectedUsers, removeMember]
  )

  const addManager = useCallback(
    async (email: string) => {
      setAddManagerError(undefined)

      try {
        const data = await postJSON<{ user: User }>(paths.addManager, {
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
          } else {
            updateMemberView(alreadyListed._id, {
              ...alreadyListed,
              isEntityManager: true,
            })
          }
        }
      } catch (error: unknown) {
        debugConsole.error(error)
        setAddManagerError((error as FetchError)?.data?.error || {})
      }
    },
    [paths.addManager, users, setUsers, updateMemberView]
  )

  const removeManager = useCallback(
    async (user: User, keepUser = false) => {
      setRemoveMemberError(undefined)

      let url
      if (paths.removeManager && user._id) {
        url = `${paths.removeManager}/${user._id}`
      } else {
        return
      }
      try {
        await deleteJSON(url, {})
        if (!keepUser) {
          setUsers(users => users.filter(u => u !== user))
        } else {
          updateMemberView(user._id, {
            ...user,
            isEntityManager: false,
          })
        }
        unselectUser(user)
      } catch (error: unknown) {
        debugConsole.error(error)
        setRemoveManagerError((error as FetchError)?.data?.error || {})
      }
    },
    [unselectUser, paths.removeManager, setUsers, updateMemberView]
  )

  const value = useMemo<GroupMembersContextValue>(
    () => ({
      users,
      selectedUsers,
      setSelectedUsers,
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
      addManager,
      addManagerError,
      removeManager,
      removeManagerError,
      memberAdded,
      paths,
    }),
    [
      users,
      setSelectedUsers,
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
      addManager,
      addManagerError,
      removeManager,
      removeManagerError,
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
