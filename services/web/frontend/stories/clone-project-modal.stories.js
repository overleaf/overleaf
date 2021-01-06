import React from 'react'

import CloneProjectModalContent from '../js/features/clone-project-modal/components/clone-project-modal-content'

// NOTE: CloneProjectModalContent is wrapped in modal classes, without modal behaviours

export const Form = args => (
  <div className="modal-dialog">
    <div className="modal-content">
      <CloneProjectModalContent {...args} />
    </div>
  </div>
)
Form.args = {
  inFlight: false,
  error: false
}

export const Loading = args => (
  <div className="modal-dialog">
    <div className="modal-content">
      <CloneProjectModalContent {...args} />
    </div>
  </div>
)
Loading.args = {
  inFlight: true,
  error: false
}

export const LoadingError = args => (
  <div className="modal-dialog">
    <div className="modal-content">
      <CloneProjectModalContent {...args} />
    </div>
  </div>
)
LoadingError.args = {
  inFlight: false,
  error: true
}

export const LoadingErrorMessage = args => (
  <div className="modal-dialog">
    <div className="modal-content">
      <CloneProjectModalContent {...args} />
    </div>
  </div>
)
LoadingErrorMessage.args = {
  inFlight: false,
  error: {
    message: 'The chosen project name is already in use'
  }
}

export default {
  title: 'Clone Project Modal',
  component: CloneProjectModalContent,
  args: {
    projectName: 'Project Title'
  },
  argTypes: {
    cloneProject: { action: 'cloneProject' },
    cancel: { action: 'cancel' }
  }
}
