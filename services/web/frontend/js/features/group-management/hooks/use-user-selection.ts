import { useCallback, useState } from 'react'
import { User } from '../../../../../types/group-management/user'

export default function useUserSelection(initialUsers: User[]) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])

  const selectAllUsers = () => setSelectedUsers(users)
  const unselectAllUsers = () => setSelectedUsers([])

  const selectAllNonManagedUsers = useCallback(() => {
    // Pending: user.enrollment will be `undefined`
    // Not managed: user.enrollment will be an empty object
    const nonManagedUsers = users.filter(user => !user.enrollment?.managedBy)

    setSelectedUsers(nonManagedUsers)
  }, [users])

  const selectUser = useCallback((user: User) => {
    setSelectedUsers(users => [...users, user])
  }, [])

  const unselectUser = useCallback((user: User) => {
    setSelectedUsers(users => users.filter(u => u.email !== user.email))
  }, [])

  return {
    users,
    setUsers,
    selectedUsers,
    selectUser,
    unselectUser,
    selectAllUsers,
    unselectAllUsers,
    selectAllNonManagedUsers,
  }
}
