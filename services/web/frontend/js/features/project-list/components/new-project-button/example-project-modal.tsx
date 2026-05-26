import { OLModal } from '@/shared/components/ol/ol-modal'
import ModalContentNewProjectForm from './modal-content-new-project-form'
import { Tag } from '../../../../../../app/src/Features/Tags/types'

type ExampleProjectModalProps = {
  onHide: () => void
  initialTags?: Tag[]
}

function ExampleProjectModal({
  onHide,
  initialTags,
}: ExampleProjectModalProps) {
  return (
    <OLModal
      show
      animation
      onHide={onHide}
      id="example-project-modal"
      backdrop="static"
    >
      <ModalContentNewProjectForm
        onCancel={onHide}
        template="example"
        initialTags={initialTags}
      />
    </OLModal>
  )
}

export default ExampleProjectModal
