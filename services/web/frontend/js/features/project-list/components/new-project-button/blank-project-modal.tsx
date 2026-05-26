import ModalContentNewProjectForm from './modal-content-new-project-form'
import { OLModal } from '@/shared/components/ol/ol-modal'
import { Tag } from '../../../../../../app/src/Features/Tags/types'

type BlankProjectModalProps = {
  onHide: () => void
  initialTags?: Tag[]
}

function BlankProjectModal({ onHide, initialTags }: BlankProjectModalProps) {
  return (
    <OLModal
      show
      animation
      onHide={onHide}
      id="blank-project-modal"
      backdrop="static"
    >
      <ModalContentNewProjectForm onCancel={onHide} initialTags={initialTags} />
    </OLModal>
  )
}

export default BlankProjectModal
