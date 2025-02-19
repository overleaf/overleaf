import { createContext, useContext, useEffect } from 'react'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { useEditorContext } from '@/shared/context/editor-context'
import getMeta from '@/utils/meta'
import {
  Permissions,
  PermissionsLevel,
} from '@/features/ide-react/types/permissions'
import useScopeValue from '@/shared/hooks/use-scope-value'
import { DeepReadonly } from '../../../../../types/utils'
import useViewerPermissions from '@/shared/hooks/use-viewer-permissions'

export const PermissionsContext = createContext<Permissions | undefined>(
  undefined
)

const permissionsMap: DeepReadonly<Record<PermissionsLevel, Permissions>> = {
  readOnly: {
    read: true,
    comment: true,
    resolveOwnComments: false,
    resolveAllComments: false,
    trackedWrite: false,
    write: false,
    admin: false,
    labelVersion: false,
  },
  review: {
    read: true,
    comment: true,
    resolveOwnComments: true,
    resolveAllComments: false,
    trackedWrite: true,
    write: false,
    admin: false,
    labelVersion: true,
  },
  readAndWrite: {
    read: true,
    comment: true,
    resolveOwnComments: true,
    resolveAllComments: true,
    trackedWrite: true,
    write: true,
    admin: false,
    labelVersion: true,
  },
  owner: {
    read: true,
    comment: true,
    resolveOwnComments: true,
    resolveAllComments: true,
    trackedWrite: true,
    write: true,
    admin: true,
    labelVersion: true,
  },
}

const anonymousPermissionsMap: typeof permissionsMap = {
  readOnly: { ...permissionsMap.readOnly, comment: false },
  readAndWrite: { ...permissionsMap.readAndWrite, comment: false },
  review: { ...permissionsMap.review, comment: false },
  owner: { ...permissionsMap.owner, comment: false },
}

const linkSharingWarningPermissionsMap: typeof permissionsMap = {
  readOnly: { ...permissionsMap.readOnly, comment: false },
  readAndWrite: permissionsMap.readAndWrite,
  review: permissionsMap.review,
  owner: permissionsMap.owner,
}

export const PermissionsProvider: React.FC = ({ children }) => {
  const [permissions, setPermissions] =
    useScopeValue<Readonly<Permissions>>('permissions')
  const { connectionState } = useConnectionContext()
  const { permissionsLevel } = useEditorContext() as {
    permissionsLevel: PermissionsLevel
  }
  const hasViewerPermissions = useViewerPermissions()
  const anonymous = getMeta('ol-anonymous')

  useEffect(() => {
    let activePermissionsMap
    if (hasViewerPermissions) {
      activePermissionsMap = linkSharingWarningPermissionsMap
    } else {
      activePermissionsMap = anonymous
        ? anonymousPermissionsMap
        : permissionsMap
    }
    setPermissions(activePermissionsMap[permissionsLevel])
  }, [anonymous, permissionsLevel, setPermissions, hasViewerPermissions])

  useEffect(() => {
    if (connectionState.forceDisconnected) {
      setPermissions(prevState => ({ ...prevState, write: false }))
    }
  }, [connectionState.forceDisconnected, setPermissions])

  return (
    <PermissionsContext.Provider value={permissions}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissionsContext() {
  const context = useContext(PermissionsContext)

  if (!context) {
    throw new Error(
      'usePermissionsContext is only available inside PermissionsProvider'
    )
  }

  return context
}
