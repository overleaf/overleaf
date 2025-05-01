import { createContext, FC, useContext, useMemo, useReducer } from 'react'
import { isCleanFilename } from '../util/safe-path'

const FileTreeCreateNameContext = createContext<
  | {
      name: string
      touchedName: boolean
      validName: boolean
      setName: (name: string) => void
    }
  | undefined
>(undefined)

export const useFileTreeCreateName = () => {
  const context = useContext(FileTreeCreateNameContext)

  if (!context) {
    throw new Error(
      'useFileTreeCreateName is only available inside FileTreeCreateNameProvider'
    )
  }

  return context
}

type State = {
  name: string
  touchedName: boolean
}

const FileTreeCreateNameProvider: FC<
  React.PropsWithChildren<{ initialName?: string }>
> = ({ children, initialName = '' }) => {
  const [state, setName] = useReducer(
    (state: State, name: string) => ({
      name, // the file name
      touchedName: true, // whether the name has been edited
    }),
    {
      name: initialName,
      touchedName: false,
    }
  )

  // validate the file name
  const validName = useMemo(() => isCleanFilename(state.name.trim()), [state])

  return (
    <FileTreeCreateNameContext.Provider
      value={{ ...state, setName, validName }}
    >
      {children}
    </FileTreeCreateNameContext.Provider>
  )
}

export default FileTreeCreateNameProvider
