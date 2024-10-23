import { Meta } from '@storybook/react'

export const bootstrapVersionArg = 'bootstrapVersion'

export const bsVersionDecorator: Meta = {
  argTypes: {
    [bootstrapVersionArg]: {
      name: 'Bootstrap Version',
      description: 'Bootstrap version for components',
      control: { type: 'inline-radio' },
      options: ['3', '5'],
      table: {
        defaultValue: { summary: '3' },
      },
    },
  },
  args: {
    [bootstrapVersionArg]: '3',
  },
}
