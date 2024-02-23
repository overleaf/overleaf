import { SplitButton } from '@/features/ui/components/bootstrap-5/split-button'
import type { Meta } from '@storybook/react'

type Args = React.ComponentProps<typeof SplitButton>

export const Dropdown = (args: Args) => {
  return <SplitButton {...args} />
}
const meta: Meta<typeof SplitButton> = {
  title: 'Shared/Components/Bootstrap 5/SplitButton',
  component: SplitButton,
  args: {
    align: { sm: 'start' },
    id: 'split-button',
    items: [
      { eventKey: '1', label: 'Action 1' },
      { eventKey: '2', label: 'Action 2' },
      { eventKey: '3', label: 'Action 3' },
    ],
    text: 'Split Button',
  },
  argTypes: {
    id: {
      table: {
        disable: true,
      },
    },
  },
  parameters: {
    bootstrap5: true,
  },
}

export default meta
