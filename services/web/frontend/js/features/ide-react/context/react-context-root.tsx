import { ConnectionProvider } from './connection-context'
import { FC } from 'react'

export const ReactContextRoot: FC = ({ children }) => {
  return <ConnectionProvider>{children}</ConnectionProvider>
}
