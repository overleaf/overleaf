import EditorSwitch from '../js/features/source-editor/components/editor-switch'
import { withContextRoot } from './utils/with-context-root'

export default {
  title: 'Editor / Switch',
  component: EditorSwitch,
}

export const Switcher = () => {
  return withContextRoot(<EditorSwitch />, {
    editor: {
      richText: false,
      newSourceEditor: false,
    },
  })
}
