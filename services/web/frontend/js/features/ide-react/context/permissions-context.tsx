import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { useEditorContext } from '@/shared/context/editor-context'
import getMeta from '@/utils/meta'
import { Permissions } from '@/features/ide-react/types/permissions'

type PermissionsContextValue = {
  permissions: Permissions
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(
  undefined
)

const readOnlyPermissions: Readonly<Permissions> = {
  read: true,
  write: false,
  admin: false,
  comment: true,
}
const readAndWritePermissions: Readonly<Permissions> = {
  read: true,
  write: true,
  admin: false,
  comment: true,
}
const ownerPermissions: Readonly<Permissions> = {
  read: true,
  write: true,
  admin: true,
  comment: true,
}
const permissionsMap = {
  readOnly: readOnlyPermissions,
  readAndWrite: readAndWritePermissions,
  owner: ownerPermissions,
  anonymous: {
    readOnly: { ...readOnlyPermissions, comment: false },
    readAndWrite: { ...readAndWritePermissions, comment: false },
    owner: { ...ownerPermissions, comment: false },
  },
} as const

export const PermissionsProvider: React.FC = ({ children }) => {
  const [permissions, setPermissions] = useState<Permissions>({
    read: false,
    write: false,
    admin: false,
    comment: false,
  })
  const { connectionState } = useConnectionContext()
  const { permissionsLevel } = useEditorContext()
  const anonymous = getMeta('ol-anonymous') as boolean | undefined

  useEffect(() => {
    if (permissionsLevel === 'readOnly') {
      if (anonymous) {
        setPermissions(permissionsMap.anonymous.readOnly)
      } else {
        setPermissions(permissionsMap.readOnly)
      }
    }
    if (permissionsLevel === 'readAndWrite') {
      if (permissions.admin) {
        if (anonymous) {
          setPermissions(permissionsMap.anonymous.owner)
        } else {
          setPermissions(permissionsMap.owner)
        }
      } else {
        if (anonymous) {
          setPermissions(permissionsMap.anonymous.readAndWrite)
        } else {
          setPermissions(permissionsMap.readAndWrite)
        }
      }
    }
    if (permissionsLevel === 'owner') {
      if (anonymous) {
        setPermissions(permissionsMap.anonymous.owner)
      } else {
        setPermissions(permissionsMap.owner)
      }
    }
  }, [anonymous, permissions, permissionsLevel])

  useEffect(() => {
    if (connectionState.forceDisconnected) {
      setPermissions(prevState => ({ ...prevState, write: false }))
    }
  }, [connectionState.forceDisconnected])

  const value = useMemo<PermissionsContextValue>(
    () => ({
      permissions,
    }),
    [permissions]
  )

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissionsContext(): PermissionsContextValue {
  const context = useContext(PermissionsContext)

  if (!context) {
    throw new Error(
      'usePermissionsContext is only available inside PermissionsProvider'
    )
  }

  return context
}
