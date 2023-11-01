import RadioChip from '../js/shared/components/radio-chip'

type Args = React.ComponentProps<typeof RadioChip>

export const RadioChipDefault = (args: Args) => {
  return <RadioChip {...args} />
}

export const RadioChipDisabled = (args: Args) => {
  return <RadioChip {...args} disabled />
}

export const RadioChipDisabledSelected = (args: Args) => {
  return <RadioChip {...args} checked disabled />
}

export default {
  title: 'Shared / Components / RadioChip',
  component: RadioChip,
  args: {
    label: 'Option',
  },
}
