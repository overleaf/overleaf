import PreviewLogsPane from '../js/features/preview/components/preview-logs-pane'
import { EditorProvider } from '../js/shared/context/editor-context'
import { UserProvider } from '../js/shared/context/user-context'
import useFetchMock from './hooks/use-fetch-mock'
import { IdeProvider } from '../js/shared/context/ide-context'

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
    <UserProvider>
      <IdeProvider ide={ide}>
        <EditorProvider settings={{}}>
          <PreviewLogsPane {...args} />
        </EditorProvider>
      </IdeProvider>
    </UserProvider>
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
    <UserProvider>
      <IdeProvider ide={ide}>
        <EditorProvider settings={{}}>
          <PreviewLogsPane {...args} />
        </EditorProvider>
      </IdeProvider>
    </UserProvider>
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
