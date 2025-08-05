import ModalContentNewProjectForm from './modal-content-new-project-form'
import OLModal from '@/features/ui/components/ol/ol-modal'

type BlankProjectModalProps = {
  onHide: () => void,
  language?: "latex" | "typst"
}

function BlankProjectModal({ onHide, language }: BlankProjectModalProps) {
  const template = language == "typst" ? "typst-none" : "none";
  return (
    <OLModal
      show
      animation
      onHide={onHide}
      id="blank-project-modal"
      backdrop="static"
    >
      <ModalContentNewProjectForm onCancel={onHide} template={template} />
    </OLModal>
  )
}

export default BlankProjectModal
