import {
  ModalFooterDecorator,
  ModalContentDecorator,
} from '../modal-decorators'
import { FileTreeModalCreateFileFooterContent } from '../../../js/features/file-tree/components/file-tree-create/file-tree-modal-create-file-footer'
import { bsVersionDecorator } from '../../../../.storybook/utils/with-bootstrap-switcher'

export const Valid = args => <FileTreeModalCreateFileFooterContent {...args} />

export const Invalid = args => (
  <FileTreeModalCreateFileFooterContent {...args} />
)
Invalid.args = {
  valid: false,
}

export const Inflight = args => (
  <FileTreeModalCreateFileFooterContent {...args} />
)
Inflight.args = {
  inFlight: true,
}

export const FileLimitWarning = args => (
  <FileTreeModalCreateFileFooterContent {...args} />
)
FileLimitWarning.args = {
  fileCount: {
    status: 'warning',
    value: 1990,
    limit: 2000,
  },
}

export const FileLimitError = args => (
  <FileTreeModalCreateFileFooterContent {...args} />
)
FileLimitError.args = {
  fileCount: {
    status: 'error',
    value: 2000,
    limit: 2000,
  },
}

export default {
  title: 'Editor / Modals / Create File / Footer',
  component: FileTreeModalCreateFileFooterContent,
  args: {
    fileCount: {
      status: 'success',
      limit: 10,
      value: 1,
    },
    valid: true,
    inFlight: false,
    newFileCreateMode: 'doc',
  },
  argTypes: {
    cancel: { action: 'cancel' },
    ...bsVersionDecorator.argTypes,
  },
  decorators: [ModalFooterDecorator, ModalContentDecorator],
}
