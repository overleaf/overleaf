import React from 'react'
import PreviewLogsPane from '../js/features/preview/components/preview-logs-pane'
import { EditorProvider } from '../js/shared/context/editor-context'
import { ApplicationProvider } from '../js/shared/context/application-context'
import useFetchMock from './hooks/use-fetch-mock'

export const TimedOutError = args => {
  useFetchMock(fetchMock => {
    fetchMock.post('express:/event/:key', 202)
  })

  const ide = {
    $scope: {
      $watch: () => () => null,
      project: {
        owner: {
          _id: window.user.id,
        },
        features: {
          compileGroup: 'standard',
        },
      },
    },
  }

  return (
    <ApplicationProvider>
      <EditorProvider ide={ide} settings={{}}>
        <PreviewLogsPane {...args} />
      </EditorProvider>
    </ApplicationProvider>
  )
}
TimedOutError.args = {
  errors: {
    timedout: {},
  },
}

export const TimedOutErrorWithPriorityCompile = args => {
  useFetchMock(fetchMock => {
    fetchMock.post('express:/event/:key', 202)
  })

  const ide = {
    $scope: {
      $watch: () => () => null,
      project: {
        owner: {
          _id: window.user.id,
        },
        features: {
          compileGroup: 'priority',
        },
      },
    },
  }

  return (
    <ApplicationProvider>
      <EditorProvider ide={ide} settings={{}}>
        <PreviewLogsPane {...args} />
      </EditorProvider>
    </ApplicationProvider>
  )
}
TimedOutErrorWithPriorityCompile.args = {
  errors: {
    timedout: {},
  },
}

export default {
  title: 'Preview Logs / Pane',
  component: PreviewLogsPane,
  argTypes: {
    onLogEntryLocationClick: { action: 'log entry location' },
    onClearCache: { action: 'clear cache' },
  },
}
