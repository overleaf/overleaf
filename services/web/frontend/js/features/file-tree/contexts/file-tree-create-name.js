import { createContext, useContext, useMemo, useReducer } from 'react'
import { isCleanFilename } from '../util/safe-path'
import PropTypes from 'prop-types'

const FileTreeCreateNameContext = createContext()

export const useFileTreeCreateName = () => {
  const context = useContext(FileTreeCreateNameContext)

  if (!context) {
    throw new Error(
      'useFileTreeCreateName is only available inside FileTreeCreateNameProvider'
    )
  }

  return context
}

export default function FileTreeCreateNameProvider({
  children,
  initialName = '',
}) {
  const [state, setName] = useReducer(
    (state, name) => ({
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

FileTreeCreateNameProvider.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]).isRequired,
  initialName: PropTypes.string,
}
