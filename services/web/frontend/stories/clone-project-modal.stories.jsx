import useFetchMock from './hooks/use-fetch-mock'
import CloneProjectModal from '../js/features/clone-project-modal/components/clone-project-modal'
import { ScopeDecorator } from './decorators/scope'

export const Success = args => {
  useFetchMock(fetchMock => {
    fetchMock.post(
      'express:/project/:projectId/clone',
      { status: 200 },
      { delay: 250 }
    )
  })

  return <CloneProjectModal {...args} />
}

export const GenericErrorResponse = args => {
  useFetchMock(fetchMock => {
    fetchMock.post(
      'express:/project/:projectId/clone',
      { status: 500 },
      { delay: 250 }
    )
  })

  return <CloneProjectModal {...args} />
}

export const SpecificErrorResponse = args => {
  useFetchMock(fetchMock => {
    fetchMock.post(
      'express:/project/:projectId/clone',
      { status: 400, body: 'The project name is not valid' },
      { delay: 250 }
    )
  })

  return <CloneProjectModal {...args} />
}

export default {
  title: 'Editor / Modals / Clone Project',
  component: CloneProjectModal,
  args: {
    show: true,
    projectName: 'Project 1',
    projectTags: [
      {
        _id: 'tag-1',
        name: 'Category 1',
        color: '#c0ffee',
      },
    ],
  },
  argTypes: {
    handleHide: { action: 'close modal' },
    openProject: { action: 'open project' },
    handleAfterCloned: { action: 'after cloned' },
  },
  decorators: [ScopeDecorator],
}
