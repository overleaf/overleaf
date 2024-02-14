import Button from '@/features/ui/components/bootstrap-5/button'
import type { Meta } from '@storybook/react'

type Args = React.ComponentProps<typeof Button>

export const NewButton = (args: Args) => {
  return <Button {...args} />
}

const meta: Meta<typeof Button> = {
  title: 'Shared / Components / Bootstrap 5 / Button',
  component: Button,
  args: {
    children: 'A Bootstrap 5 button',
  },
  parameters: {
    bootstrap5: true,
  },
}

export default meta
