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
import OutOfSyncModal, {
  OutOfSyncModalProps,
} from '@/features/ide-react/components/modals/out-of-sync-modal'

type ModalsContextValue = {
  genericModalVisible: boolean
  showGenericMessageModal: (
    title: GenericMessageModalOwnProps['title'],
    message: GenericMessageModalOwnProps['message']
  ) => void
  showOutOfSyncModal: (
    editorContent: OutOfSyncModalProps['editorContent']
  ) => void
}

const ModalsContext = createContext<ModalsContextValue | undefined>(undefined)

export const ModalsContextProvider: FC = ({ children }) => {
  const [showGenericModal, setShowGenericModal] = useState(false)
  const [genericMessageModalData, setGenericMessageModalData] =
    useState<GenericMessageModalOwnProps>({ title: '', message: '' })

  const [shouldShowOutOfSyncModal, setShouldShowOutOfSyncModal] =
    useState(false)
  const [outOfSyncModalData, setOutOfSyncModalData] = useState({
    editorContent: '',
  })

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

  const handleHideOutOfSyncModal = useCallback(() => {
    setShouldShowOutOfSyncModal(false)
  }, [])

  const showOutOfSyncModal = useCallback((editorContent: string) => {
    setOutOfSyncModalData({ editorContent })
    setShouldShowOutOfSyncModal(true)
  }, [])

  const value = useMemo<ModalsContextValue>(
    () => ({
      showGenericMessageModal,
      genericModalVisible: showGenericModal,
      showOutOfSyncModal,
    }),
    [showGenericMessageModal, showGenericModal, showOutOfSyncModal]
  )

  return (
    <ModalsContext.Provider value={value}>
      {children}
      <GenericMessageModal
        show={showGenericModal}
        onHide={handleHideGenericModal}
        {...genericMessageModalData}
      />
      <OutOfSyncModal
        {...outOfSyncModalData}
        show={shouldShowOutOfSyncModal}
        onHide={handleHideOutOfSyncModal}
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
