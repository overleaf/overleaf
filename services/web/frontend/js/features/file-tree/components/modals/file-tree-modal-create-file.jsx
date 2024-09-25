import { useTranslation } from 'react-i18next'
import { useFileTreeActionable } from '../../contexts/file-tree-actionable'
import FileTreeCreateFormProvider from '../../contexts/file-tree-create-form'
import FileTreeModalCreateFileBody from '../file-tree-create/file-tree-modal-create-file-body'
import FileTreeModalCreateFileFooter from '../file-tree-create/file-tree-modal-create-file-footer'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'

export default function FileTreeModalCreateFile() {
  const { t } = useTranslation()

  const { isCreatingFile, cancel } = useFileTreeActionable()

  if (!isCreatingFile) {
    return null
  }

  return (
    <FileTreeCreateFormProvider>
      <OLModal size="lg" onHide={cancel} show>
        <OLModalHeader closeButton>
          <OLModalTitle>{t('add_files')}</OLModalTitle>
        </OLModalHeader>

        <OLModalBody className="modal-new-file">
          <FileTreeModalCreateFileBody />
        </OLModalBody>

        <OLModalFooter>
          <FileTreeModalCreateFileFooter />
        </OLModalFooter>
      </OLModal>
    </FileTreeCreateFormProvider>
  )
}
