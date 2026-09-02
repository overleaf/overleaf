import ModalContentNewProjectForm from './modal-content-new-project-form'
import { OLModal } from '@/shared/components/ol/ol-modal'
import { Tag } from '../../../../../../app/src/Features/Tags/types'
import { useFeatureFlag } from '@/shared/context/split-test-context'

type BlankProjectModalProps = {
  onHide: () => void
  initialTags?: Tag[]
}

function BlankProjectModal({ onHide, initialTags }: BlankProjectModalProps) {
  const themed = useFeatureFlag('themed-modals')

  return (
    <OLModal
      show
      animation
      onHide={onHide}
      id="blank-project-modal"
      backdrop="static"
      themed={themed}
      className="project-list-modal"
    >
      <ModalContentNewProjectForm onCancel={onHide} initialTags={initialTags} />
    </OLModal>
  )
}

export default BlankProjectModal
