import useFetchMock from './hooks/use-fetch-mock'
import { withContextRoot } from './utils/with-context-root'
import CloneProjectModal from '../js/features/clone-project-modal/components/clone-project-modal'

const project = { _id: 'original-project', name: 'Project Title' }

export const Success = args => {
  useFetchMock(fetchMock => {
    fetchMock.post(
      'express:/project/:projectId/clone',
      { status: 200 },
      { delay: 250 }
    )
  })

  return withContextRoot(<CloneProjectModal {...args} />, { project })
}

export const GenericErrorResponse = args => {
  useFetchMock(fetchMock => {
    fetchMock.post(
      'express:/project/:projectId/clone',
      { status: 500 },
      { delay: 250 }
    )
  })

  return withContextRoot(<CloneProjectModal {...args} />, { project })
}

export const SpecificErrorResponse = args => {
  useFetchMock(fetchMock => {
    fetchMock.post(
      'express:/project/:projectId/clone',
      { status: 400, body: 'The project name is not valid' },
      { delay: 250 }
    )
  })

  return withContextRoot(<CloneProjectModal {...args} />, { project })
}

export default {
  title: 'Editor / Modals / Clone Project',
  component: CloneProjectModal,
  args: {
    show: true,
  },
  argTypes: {
    handleHide: { action: 'close modal' },
    openProject: { action: 'open project' },
  },
}
