import {
  createContext,
  FC,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { getJSON } from '@/infrastructure/fetch-json'
import { useProjectContext } from '@/shared/context/project-context'
import { UserId } from '../../../../../types/user'

export type ChangesUser = {
  id: UserId
  email: string
  first_name?: string
  last_name?: string
}

export type ChangesUsers = Map<UserId, ChangesUser>

export const ChangesUsersContext = createContext<ChangesUsers | undefined>(
  undefined
)

export const ChangesUsersProvider: FC = ({ children }) => {
  const { _id: projectId, members, owner } = useProjectContext()

  const [changesUsers, setChangesUsers] = useState<ChangesUsers>()

  useEffect(() => {
    getJSON<ChangesUser[]>(`/project/${projectId}/changes/users`).then(data =>
      setChangesUsers(new Map(data.map(item => [item.id, item])))
    )
  }, [projectId])

  // add the project owner and members to the changes users data
  const value = useMemo(() => {
    const value: ChangesUsers = new Map(changesUsers)
    value.set(owner._id, { ...owner, id: owner._id })
    for (const member of members) {
      value.set(member._id, { ...member, id: member._id })
    }
    return value
  }, [members, owner, changesUsers])

  return (
    <ChangesUsersContext.Provider value={value}>
      {children}
    </ChangesUsersContext.Provider>
  )
}

export const useChangesUsersContext = () => {
  return useContext(ChangesUsersContext)
}
