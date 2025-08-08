import { Meta, StoryObj } from '@storybook/react'
import { OLToast } from '@/shared/components/ol/ol-toast'
import { SynctexFileErrorToast } from '@/features/pdf-preview/components/synctex-toasts'

const meta = {
  title: 'Editor/ Synctex File Error Toast',
  component: SynctexFileErrorToast,
  decorators: [
    Story => (
      <div style={{ width: 'fit-content' }}>
        <OLToast type="warning" isDismissible content={<Story />} />
      </div>
    ),
  ],
} satisfies Meta<typeof SynctexFileErrorToast>

export default meta
type Story = StoryObj<typeof meta>

export const WithoutFile = {
  args: { data: {} },
} satisfies Story

export const WithFile = {
  args: { data: { filePath: 'references.bbl' } },
} satisfies Story
