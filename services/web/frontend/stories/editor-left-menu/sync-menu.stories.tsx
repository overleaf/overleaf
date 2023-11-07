import SyncMenu from '../../js/features/editor-left-menu/components/sync-menu'
import { ScopeDecorator } from '../decorators/scope'
import { useScope } from '../hooks/use-scope'

export default {
  title: 'Editor / Left Menu / Sync Menu',
  component: SyncMenu,
  decorators: [ScopeDecorator],
}

export const WriteAccess = () => {
  window.metaAttributesCache.set('ol-anonymous', false)
  window.metaAttributesCache.set('ol-gitBridgeEnabled', true)
  useScope({
    permissionsLevel: 'owner',
  })

  return (
    <div id="left-menu" className="shown">
      <SyncMenu />
    </div>
  )
}

export const ReadOnlyAccess = () => {
  window.metaAttributesCache.set('ol-anonymous', false)
  window.metaAttributesCache.set('ol-gitBridgeEnabled', true)
  useScope({
    permissionsLevel: 'readOnly',
  })

  return (
    <div id="left-menu" className="shown">
      <SyncMenu />
    </div>
  )
}
