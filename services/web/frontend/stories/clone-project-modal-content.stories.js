import CloneProjectModalContent from '../js/features/clone-project-modal/components/clone-project-modal-content'

export const Basic = args => {
  return <CloneProjectModalContent {...args} />
}

export const Invalid = args => {
  return (
    <CloneProjectModalContent {...args} clonedProjectName="" valid={false} />
  )
}

export const Inflight = args => {
  return <CloneProjectModalContent {...args} inFlight />
}

export const GenericError = args => {
  return <CloneProjectModalContent {...args} error />
}

export const SpecificError = args => {
  return (
    <CloneProjectModalContent {...args} error="There was a specific error" />
  )
}

export default {
  title: 'Modals / Clone Project / Content',
  component: CloneProjectModalContent,
  args: {
    animation: false,
    projectId: 'original-project',
    clonedProjectName: 'Project Title',
    show: true,
    error: false,
    inFlight: false,
    valid: true,
  },
  argTypes: {
    cancel: { action: 'cancel' },
    handleSubmit: { action: 'submit' },
    setClonedProjectName: { action: 'set project name' },
  },
}
