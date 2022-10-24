import HelpMenu from '../../js/features/editor-left-menu/components/help-menu'
import { ScopeDecorator } from '../decorators/scope'

export default {
  title: 'Editor / Left Menu / Help Menu',
  component: HelpMenu,
  decorators: [ScopeDecorator],
}

export const ShowSupport = () => {
  window.metaAttributesCache.set('ol-showSupport', true)
  window.metaAttributesCache.set('ol-user', {
    email: 'sherlock@holmes.co.uk',
    first_name: 'Sherlock',
    last_name: 'Holmes',
  })

  return (
    <div id="left-menu" className="shown">
      <HelpMenu />
    </div>
  )
}

export const HideSupport = () => {
  window.metaAttributesCache.set('ol-showSupport', false)

  return (
    <div id="left-menu" className="shown">
      <HelpMenu />
    </div>
  )
}
