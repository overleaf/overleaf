import { OLModal } from '@/shared/components/ol/ol-modal'
import ModalContentNewProjectForm from './modal-content-new-project-form'

type ExampleProjectModalProps = {
  onHide: () => void
}

function ExampleProjectModal({ onHide }: ExampleProjectModalProps) {
  return (
    <OLModal
      show
      animation
      onHide={onHide}
      id="example-project-modal"
      backdrop="static"
    >
      <ModalContentNewProjectForm onCancel={onHide} template="example" />
    </OLModal>
  )
}

export default ExampleProjectModal
