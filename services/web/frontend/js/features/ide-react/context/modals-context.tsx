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
import GenericConfirmModal, {
  GenericConfirmModalOwnProps,
} from '../components/modals/generic-confirm-modal'

type ModalsContextValue = {
  genericModalVisible: boolean
  showGenericConfirmModal: (data: GenericConfirmModalOwnProps) => void
  showGenericMessageModal: (
    title: GenericMessageModalOwnProps['title'],
    message: GenericMessageModalOwnProps['message']
  ) => void
  showOutOfSyncModal: (
    editorContent: OutOfSyncModalProps['editorContent']
  ) => void
}

const ModalsContext = createContext<ModalsContextValue | undefined>(undefined)

export const ModalsContextProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [showGenericModal, setShowGenericModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [genericMessageModalData, setGenericMessageModalData] =
    useState<GenericMessageModalOwnProps>({ title: '', message: '' })
  const [genericConfirmModalData, setGenericConfirmModalData] =
    useState<GenericConfirmModalOwnProps>({
      title: '',
      message: '',
      onConfirm: () => {},
    })

  const [shouldShowOutOfSyncModal, setShouldShowOutOfSyncModal] =
    useState(false)
  const [outOfSyncModalData, setOutOfSyncModalData] = useState({
    editorContent: '',
  })

  const handleHideGenericModal = useCallback(() => {
    setShowGenericModal(false)
  }, [])

  const handleHideGenericConfirmModal = useCallback(() => {
    setShowConfirmModal(false)
  }, [])

  const handleConfirmGenericConfirmModal = useCallback(() => {
    genericConfirmModalData.onConfirm()
    setShowConfirmModal(false)
  }, [genericConfirmModalData])

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

  const showGenericConfirmModal = useCallback(
    (data: GenericConfirmModalOwnProps) => {
      setGenericConfirmModalData(data)
      setShowConfirmModal(true)
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
      showGenericConfirmModal,
      genericModalVisible: showGenericModal,
      showOutOfSyncModal,
    }),
    [
      showGenericMessageModal,
      showGenericConfirmModal,
      showGenericModal,
      showOutOfSyncModal,
    ]
  )

  return (
    <ModalsContext.Provider value={value}>
      {children}
      <GenericMessageModal
        show={showGenericModal}
        onHide={handleHideGenericModal}
        {...genericMessageModalData}
      />
      <GenericConfirmModal
        show={showConfirmModal}
        onHide={handleHideGenericConfirmModal}
        {...genericConfirmModalData}
        onConfirm={handleConfirmGenericConfirmModal}
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
