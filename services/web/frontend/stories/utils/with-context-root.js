import { ContextRoot } from '../../js/shared/context/root-context'
import _ from 'lodash'

// Unfortunately, we cannot currently use decorators here, since we need to
// set a value on window, before the contexts are rendered.
// When using decorators, the contexts are rendered before the story, so we
// don't have the opportunity to set the window value first.
export function withContextRoot(Story, scope) {
  const scopeWatchers = []

  const ide = {
    ...window._ide,
    $scope: {
      ...window._ide.$scope,
      ...scope,
      $watch: (key, callback) => {
        scopeWatchers.push([key, callback])
      },
      $applyAsync: callback => {
        window.setTimeout(() => {
          callback()
          for (const [key, watcher] of scopeWatchers) {
            watcher(_.get(ide.$scope, key))
          }
        }, 0)
      },
      $on: (eventName, callback) => {
        //
      },
    },
  }

  return (
    <ContextRoot ide={ide} settings={{}}>
      {Story}
    </ContextRoot>
  )
}
