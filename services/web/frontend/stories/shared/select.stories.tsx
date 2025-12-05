import { Select } from '@/shared/components/select'
import { Meta } from '@storybook/react'

type Args = Pick<
  React.ComponentProps<typeof Select>,
  'disabled' | 'defaultText' | 'isCiam'
>

const items = [1, 2, 3, 4].map(index => ({
  key: index,
  value: `Demo item ${index}`,
  group: index >= 3 ? 'Large numbers' : undefined,
}))

export const Base = (args: Args) => {
  return (
    <Select
      {...args}
      items={items}
      itemToString={x => String(x?.value)}
      itemToKey={x => String(x.key)}
    />
  )
}

export const WithSubtitles = (args: Args) => {
  return (
    <Select
      {...args}
      items={items}
      itemToString={x => String(x?.value)}
      itemToKey={x => String(x.key)}
      itemToSubtitle={x => x?.group ?? ''}
    />
  )
}

export const WithSelectedIcon = (args: Args) => {
  return (
    <Select
      {...args}
      items={items}
      itemToString={x => String(x?.value)}
      itemToKey={x => String(x.key)}
      itemToSubtitle={x => x?.group ?? ''}
      selectedIcon
    />
  )
}

export const WithDisabledItem = (args: Args) => {
  return (
    <Select
      {...args}
      items={items}
      itemToString={x => String(x?.value)}
      itemToKey={x => String(x.key)}
      itemToDisabled={x => x?.key === 1}
      itemToSubtitle={x => x?.group ?? ''}
    />
  )
}

const meta: Meta<typeof Select> = {
  title: 'Shared / Components / Select',
  component: Select,
  parameters: {
    controls: {
      include: ['disabled', 'defaultText', 'isCiam'],
    },
  },
  args: {
    disabled: false,
    isCiam: false,
    defaultText: 'Choose an item',
  },
}

export default meta
