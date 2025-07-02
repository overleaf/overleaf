import { createContext, FC, useContext, useMemo, useState } from 'react'

const PdfPreviewContext = createContext<
  | {
      loadingError: boolean
      setLoadingError: (value: boolean) => void
    }
  | undefined
>(undefined)

export const usePdfPreviewContext = () => {
  const context = useContext(PdfPreviewContext)
  if (!context) {
    throw new Error(
      'usePdfPreviewContext is only available inside PdfPreviewProvider'
    )
  }
  return context
}

export const PdfPreviewProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [loadingError, setLoadingError] = useState(false)

  const value = useMemo(
    () => ({ loadingError, setLoadingError }),
    [loadingError]
  )

  return (
    <PdfPreviewContext.Provider value={value}>
      {children}
    </PdfPreviewContext.Provider>
  )
}
