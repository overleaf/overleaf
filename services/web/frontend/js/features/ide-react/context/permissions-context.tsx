import { createContext, useContext, useEffect, useState } from 'react'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import getMeta from '@/utils/meta'
import {
  Permissions,
  PermissionsLevel,
} from '@/features/ide-react/types/permissions'
import { DeepReadonly } from '../../../../../types/utils'
import useViewerPermissions from '@/shared/hooks/use-viewer-permissions'
import { useProjectContext } from '@/shared/context/project-context'

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

const noTrackChangesPermissionsMap: typeof permissionsMap = {
  readOnly: permissionsMap.readOnly,
  readAndWrite: permissionsMap.readAndWrite,
  review: { ...permissionsMap.review, trackedWrite: false },
  owner: permissionsMap.owner,
}

const defaultPermissions: Permissions = {
  read: true,
  write: true,
  admin: false,
  comment: true,
  resolveOwnComments: false,
  resolveAllComments: false,
  trackedWrite: true,
  labelVersion: false,
}

export const PermissionsProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [permissions, setPermissions] =
    useState<Permissions>(defaultPermissions)
  const { connectionState } = useConnectionContext()
  const { permissionsLevel } = useIdeReactContext()
  const hasViewerPermissions = useViewerPermissions()
  const anonymous = getMeta('ol-anonymous')
  const { features } = useProjectContext()

  useEffect(() => {
    let activePermissionsMap
    if (hasViewerPermissions) {
      activePermissionsMap = linkSharingWarningPermissionsMap
    } else if (anonymous) {
      activePermissionsMap = anonymousPermissionsMap
    } else if (!features.trackChanges) {
      activePermissionsMap = noTrackChangesPermissionsMap
    } else {
      activePermissionsMap = permissionsMap
    }
    setPermissions(activePermissionsMap[permissionsLevel])
  }, [
    anonymous,
    permissionsLevel,
    setPermissions,
    hasViewerPermissions,
    features.trackChanges,
  ])

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
