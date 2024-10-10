import EditorSwitch from '../js/features/source-editor/components/editor-switch'
import { ScopeDecorator } from './decorators/scope'
import { bsVersionDecorator } from '../../.storybook/utils/with-bootstrap-switcher'

export default {
  title: 'Editor / Switch',
  component: EditorSwitch,
  decorators: [ScopeDecorator],
  argTypes: {
    ...bsVersionDecorator.argTypes,
  },
}

export const Switcher = () => {
  return <EditorSwitch />
}
