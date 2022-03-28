import EditorSwitch from '../js/features/source-editor/components/editor-switch'
import { setupContext } from './fixtures/context'
import { withContextRoot } from './utils/with-context-root'

export default {
  title: 'Editor / Switch',
  component: EditorSwitch,
}

setupContext()

export const Switcher = () => {
  return withContextRoot(<EditorSwitch />, {
    editor: {
      richText: false,
      newSourceEditor: false,
    },
  })
}
