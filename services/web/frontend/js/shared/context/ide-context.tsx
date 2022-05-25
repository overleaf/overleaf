import { createContext, FC, useContext, useState } from 'react'
import { getMockIde } from './mock/mock-ide'

type Ide = {
  [key: string]: any // TODO: define the rest of the `ide` and `$scope` properties
  $scope: Record<string, any>
}

const IdeContext = createContext<Ide | null>(null)

export const IdeProvider: FC<{ ide: Ide }> = ({ ide, children }) => {
  const [value] = useState(() => ide || getMockIde())

  return <IdeContext.Provider value={value}>{children}</IdeContext.Provider>
}

export function useIdeContext(): Ide {
  const context = useContext(IdeContext)

  if (!context) {
    throw new Error('useIdeContext is only available inside IdeProvider')
  }

  return context
}
