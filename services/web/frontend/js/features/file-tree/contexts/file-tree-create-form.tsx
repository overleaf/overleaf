import { createContext, FC, useContext, useState } from 'react'

const FileTreeCreateFormContext = createContext<
  { valid: boolean; setValid: (value: boolean) => void } | undefined
>(undefined)

export const useFileTreeCreateForm = () => {
  const context = useContext(FileTreeCreateFormContext)

  if (!context) {
    throw new Error(
      'useFileTreeCreateForm is only available inside FileTreeCreateFormProvider'
    )
  }

  return context
}

const FileTreeCreateFormProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
  // is the form valid
  const [valid, setValid] = useState(false)

  return (
    <FileTreeCreateFormContext.Provider value={{ valid, setValid }}>
      {children}
    </FileTreeCreateFormContext.Provider>
  )
}

export default FileTreeCreateFormProvider
