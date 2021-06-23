import PropTypes from 'prop-types'

import CloneProjectModal from '../js/features/clone-project-modal/components/clone-project-modal'
import useFetchMock from './hooks/use-fetch-mock'

export const Interactive = ({
  mockResponse = 200,
  mockResponseDelay = 500,
  ...args
}) => {
  useFetchMock(fetchMock => {
    fetchMock.post(
      'express:/project/:projectId/clone',
      () => {
        switch (mockResponse) {
          case 400:
            return { status: 400, body: 'The project name is not valid' }

          default:
            return mockResponse
        }
      },
      { delay: mockResponseDelay }
    )
  })

  return <CloneProjectModal {...args} />
}
Interactive.propTypes = {
  mockResponse: PropTypes.number,
  mockResponseDelay: PropTypes.number,
}

export default {
  title: 'Modals / Clone Project',
  component: CloneProjectModal,
  args: {
    projectId: 'original-project',
    projectName: 'Project Title',
    show: true,
  },
  argTypes: {
    handleHide: { action: 'close modal' },
    openProject: { action: 'open project' },
    mockResponse: {
      name: 'Mock Response Status',
      type: { name: 'number', required: false },
      description: 'The status code that should be returned by the mock server',
      defaultValue: 200,
      control: {
        type: 'radio',
        options: [200, 500, 400],
      },
    },
    mockResponseDelay: {
      name: 'Mock Response Delay',
      type: { name: 'number', required: false },
      description: 'The delay before returning a response from the mock server',
      defaultValue: 500,
      control: {
        type: 'range',
        min: 0,
        max: 2500,
        step: 250,
      },
    },
  },
}
