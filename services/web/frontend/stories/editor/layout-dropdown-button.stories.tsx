import { LayoutDropdownButtonUi } from '@/features/editor-navigation-toolbar/components/layout-dropdown-button'
import { Meta } from '@storybook/react'
import { bsVersionDecorator } from '../../../.storybook/utils/with-bootstrap-switcher'
import { ComponentProps } from 'react'

export const LayoutDropdown = (
  props: ComponentProps<typeof LayoutDropdownButtonUi>
) => (
  <div className="toolbar toolbar-header justify-content-end m-4">
    <div className="toolbar-right">
      <LayoutDropdownButtonUi {...props} />
    </div>
  </div>
)

const meta: Meta<typeof LayoutDropdownButtonUi> = {
  title: 'Editor / Toolbar / Layout Dropdown',
  component: LayoutDropdownButtonUi,
  argTypes: {
    view: {
      control: 'select',
      options: [null, 'editor', 'file', 'pdf', 'history'],
    },
    detachRole: {
      control: 'select',
      options: ['detacher', 'detached'],
    },
    pdfLayout: {
      control: 'select',
      options: ['sideBySide', 'flat'],
    },
    ...bsVersionDecorator.argTypes,
  },
  parameters: { actions: { argTypesRegex: '^handle.*' } },
}

export default meta
