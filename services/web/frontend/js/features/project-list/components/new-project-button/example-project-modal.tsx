import AccessibleModal from '../../../../shared/components/accessible-modal'
import ModalContentNewProjectForm from './modal-content-new-project-form'

type ExampleProjectModalProps = {
  onHide: () => void
}

function ExampleProjectModal({ onHide }: ExampleProjectModalProps) {
  return (
    <AccessibleModal
      show
      animation
      onHide={onHide}
      id="example-project-modal"
      backdrop="static"
    >
      <ModalContentNewProjectForm onCancel={onHide} template="example" />
    </AccessibleModal>
  )
}

export default ExampleProjectModal
