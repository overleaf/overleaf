import {
  createContext,
  useContext,
  FC,
  useCallback,
  useMemo,
  useState,
} from 'react'
import GenericMessageModal, {
  GenericMessageModalOwnProps,
} from '@/features/ide-react/components/modals/generic-message-modal'

type ModalsContextValue = {
  showGenericMessageModal: (
    title: GenericMessageModalOwnProps['title'],
    message: GenericMessageModalOwnProps['message']
  ) => void
}

const ModalsContext = createContext<ModalsContextValue | undefined>(undefined)

export const ModalsContextProvider: FC = ({ children }) => {
  const [showGenericModal, setShowGenericModal] = useState(false)
  const [genericMessageModalData, setGenericMessageModalData] =
    useState<GenericMessageModalOwnProps>({ title: '', message: '' })

  const handleHideGenericModal = useCallback(() => {
    setShowGenericModal(false)
  }, [])

  const showGenericMessageModal = useCallback(
    (
      title: GenericMessageModalOwnProps['title'],
      message: GenericMessageModalOwnProps['message']
    ) => {
      setGenericMessageModalData({ title, message })
      setShowGenericModal(true)
    },
    []
  )

  const value = useMemo<ModalsContextValue>(
    () => ({
      showGenericMessageModal,
    }),
    [showGenericMessageModal]
  )

  return (
    <ModalsContext.Provider value={value}>
      {children}
      <GenericMessageModal
        show={showGenericModal}
        onHide={handleHideGenericModal}
        {...genericMessageModalData}
      />
    </ModalsContext.Provider>
  )
}

export function useModalsContext(): ModalsContextValue {
  const context = useContext(ModalsContext)

  if (!context) {
    throw new Error(
      'useModalsContext is only available inside ModalsContextProvider'
    )
  }

  return context
}
