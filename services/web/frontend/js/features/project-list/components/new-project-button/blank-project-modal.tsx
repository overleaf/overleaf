import AccessibleModal from '../../../../shared/components/accessible-modal'
import ModalContentNewProjectForm from './modal-content-new-project-form'

type BlankProjectModalProps = {
  onHide: () => void
}

function BlankProjectModal({ onHide }: BlankProjectModalProps) {
  return (
    <AccessibleModal
      show
      animation
      onHide={onHide}
      id="blank-project-modal"
      backdrop="static"
    >
      <ModalContentNewProjectForm onCancel={onHide} />
    </AccessibleModal>
  )
}

export default BlankProjectModal
