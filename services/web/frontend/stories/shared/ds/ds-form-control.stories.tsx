import { Meta } from '@storybook/react'
import { figmaDesignUrl } from '../../../../.storybook/utils/figma-design-url'
import DSFormControl from '@/shared/components/ds/ds-form-control'
import DSFormText from '@/shared/components/ds/ds-form-text'
import DSFormGroup from '@/shared/components/ds/ds-form-group'
import DSFormLabel from '@/shared/components/ds/ds-form-label'
import { ComponentProps } from 'react'

type Args = ComponentProps<typeof DSFormControl> & {
  textType: ComponentProps<typeof DSFormText>['type']
}

export const FormControl = ({ textType, value, ...args }: Args) => {
  return (
    <DSFormGroup>
      <DSFormLabel htmlFor="form-control-id">Form input label</DSFormLabel>
      <DSFormControl
        id="form-control-id"
        name="form-control-name"
        {...args}
        value={value || undefined}
      />
      <DSFormText type={textType}>Form input feedback</DSFormText>
    </DSFormGroup>
  )
}

const meta: Meta<typeof FormControl> = {
  title: 'Shared / DS Components / Form',
  component: FormControl,
  argTypes: {
    disabled: { control: 'boolean' },
    isInvalid: { control: 'boolean' },
    placeholder: { control: 'text' },
    readOnly: { control: 'boolean' },
    value: { control: 'text' },
    size: { control: 'radio', options: ['lg', undefined] },
    textType: { control: 'radio', options: ['error', 'success', undefined] },
  },
  parameters: {
    controls: {
      include: [
        'disabled',
        'isInvalid',
        'placeholder',
        'readOnly',
        'size',
        'value',
        'textType',
      ],
    },
    ...figmaDesignUrl(
      'https://www.figma.com/design/aJQlecvqCS9Ry8b6JA1lQN/DS---Components?node-id=6318-428&t=pcx9KKzhlzpRmA4S-0'
    ),
  },
}

export default meta
