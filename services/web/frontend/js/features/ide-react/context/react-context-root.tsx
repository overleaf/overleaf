import { ConnectionProvider } from './connection-context'
import { FC } from 'react'
import { IdeReactProvider } from '@/features/ide-react/context/ide-react-context'
import { ProjectProvider } from '@/shared/context/project-context'
import { UserProvider } from '@/shared/context/user-context'

export const ReactContextRoot: FC = ({ children }) => {
  return (
    <ConnectionProvider>
      <IdeReactProvider>
        <UserProvider>
          <ProjectProvider>{children}</ProjectProvider>
        </UserProvider>
      </IdeReactProvider>
    </ConnectionProvider>
  )
}
