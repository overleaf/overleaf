import ModalContentNewProjectForm from './modal-content-new-project-form'
import { OLModal } from '@/shared/components/ol/ol-modal'

type BlankProjectModalProps = {
  onHide: () => void
}

function BlankProjectModal({ onHide }: BlankProjectModalProps) {
  return (
    <OLModal
      show
      animation
      onHide={onHide}
      id="blank-project-modal"
      backdrop="static"
    >
      <ModalContentNewProjectForm onCancel={onHide} />
    </OLModal>
  )
}

export default BlankProjectModal
