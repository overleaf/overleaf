import React from 'react'
import fetchMock from 'fetch-mock'
import PropTypes from 'prop-types'

import WordCountModal from '../js/features/word-count-modal/components/word-count-modal'

export const Interactive = ({
  mockResponse = 200,
  mockResponseDelay = 500,
  ...args
}) => {
  fetchMock.restore().get(
    'express:/project/:projectId/wordcount',
    () => {
      switch (mockResponse) {
        case 400:
          return { status: 400, body: 'The project id is not valid' }

        case 200:
          return {
            texcount: {
              headers: 4,
              mathDisplay: 40,
              mathInline: 400,
              textWords: 4000,
            },
          }

        default:
          return mockResponse
      }
    },
    { delay: mockResponseDelay }
  )

  return <WordCountModal {...args} />
}
Interactive.propTypes = {
  mockResponse: PropTypes.number,
  mockResponseDelay: PropTypes.number,
}

export default {
  title: 'Modals / Word Count',
  component: WordCountModal,
  args: {
    clsiServerId: 'server-id',
    projectId: 'project-id',
    show: true,
  },
  argTypes: {
    handleHide: { action: 'handleHide' },
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
