import LabeledDivider from '@/shared/components/labeled-divider'
import { Meta } from '@storybook/react'

type Args = React.ComponentProps<typeof LabeledDivider>

export const Default = (args: Args) => {
  return <LabeledDivider {...args} />
}

const meta: Meta<typeof LabeledDivider> = {
  title: 'Shared / Components / Labeled Divider',
  component: LabeledDivider,
  args: {
    children: 'Text',
  },
}

export default meta
