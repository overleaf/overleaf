import { Select } from '../../js/shared/components/select'

const items = [1, 2, 3, 4].map(index => ({
  key: index,
  value: `Demo item ${index}`,
  group: index >= 3 ? 'Large numbers' : undefined,
}))

export const Base = () => {
  return (
    <Select
      items={items}
      itemToString={x => String(x?.value)}
      itemToKey={x => String(x.key)}
    />
  )
}

export const WithSubtitles = () => {
  return (
    <Select
      items={items}
      itemToString={x => String(x?.value)}
      itemToKey={x => String(x.key)}
      itemToSubtitle={x => x?.group ?? ''}
    />
  )
}

export const WithSelectedIcon = () => {
  return (
    <Select
      items={items}
      itemToString={x => String(x?.value)}
      itemToKey={x => String(x.key)}
      itemToSubtitle={x => x?.group ?? ''}
      selectedIcon
    />
  )
}

export const WithDisabledItem = () => {
  return (
    <Select
      items={items}
      itemToString={x => String(x?.value)}
      itemToKey={x => String(x.key)}
      itemToDisabled={x => x?.key === 1}
      itemToSubtitle={x => x?.group ?? ''}
    />
  )
}

export default {
  title: 'Shared / Components / Select',
  component: Select,
  parameters: {
    controls: {
      include: ['disabled', 'defaultText'],
    },
  },
  args: {
    disabled: false,
    defaultText: 'Choose an item',
  },
}
