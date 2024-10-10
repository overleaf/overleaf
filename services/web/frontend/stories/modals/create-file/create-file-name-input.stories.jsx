import FileTreeCreateNameInput from '../../../js/features/file-tree/components/file-tree-create/file-tree-create-name-input'
import FileTreeCreateNameProvider from '../../../js/features/file-tree/contexts/file-tree-create-name'
import {
  BlockedFilenameError,
  DuplicateFilenameError,
} from '../../../js/features/file-tree/errors'
import { ModalBodyDecorator, ModalContentDecorator } from '../modal-decorators'
import { bsVersionDecorator } from '../../../../.storybook/utils/with-bootstrap-switcher'

export const DefaultLabel = args => (
  <FileTreeCreateNameProvider initialName="example.tex">
    <FileTreeCreateNameInput {...args} />
  </FileTreeCreateNameProvider>
)

export const CustomLabel = args => (
  <FileTreeCreateNameProvider initialName="example.tex">
    <FileTreeCreateNameInput {...args} />
  </FileTreeCreateNameProvider>
)
CustomLabel.args = {
  label: 'File Name in this Project',
}

export const FocusName = args => (
  <FileTreeCreateNameProvider initialName="example.tex">
    <FileTreeCreateNameInput {...args} />
  </FileTreeCreateNameProvider>
)
FocusName.args = {
  focusName: true,
}

export const CustomPlaceholder = args => (
  <FileTreeCreateNameProvider>
    <FileTreeCreateNameInput {...args} />
  </FileTreeCreateNameProvider>
)
CustomPlaceholder.args = {
  placeholder: 'Enter a file name…',
}

export const DuplicateError = args => (
  <FileTreeCreateNameProvider initialName="main.tex">
    <FileTreeCreateNameInput {...args} />
  </FileTreeCreateNameProvider>
)
DuplicateError.args = {
  error: new DuplicateFilenameError(),
}

export const BlockedError = args => (
  <FileTreeCreateNameProvider initialName="main.tex">
    <FileTreeCreateNameInput {...args} />
  </FileTreeCreateNameProvider>
)
BlockedError.args = {
  error: new BlockedFilenameError(),
}

export default {
  title: 'Editor / Modals / Create File / File Name Input',
  component: FileTreeCreateNameInput,
  decorators: [ModalBodyDecorator, ModalContentDecorator],
  args: {
    inFlight: false,
  },
  argTypes: {
    ...bsVersionDecorator.argTypes,
  },
}
