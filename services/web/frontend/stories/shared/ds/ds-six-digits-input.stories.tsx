import { ComponentProps, useEffect, useState } from 'react'
import { Meta } from '@storybook/react'
import { figmaDesignUrl } from '../../../../.storybook/utils/figma-design-url'
import DSFormGroup from '@/shared/components/ds/ds-form-group'
import DSFormLabel from '@/shared/components/ds/ds-form-label'
import CIAMSixDigitsInput from '@/features/settings/components/emails/ciam-six-digits-input'

type Args = ComponentProps<typeof CIAMSixDigitsInput>

export const SixDigitsInput = ({ value, ...args }: Args) => {
  const [state, setState] = useState(value)
  useEffect(() => setState(value), [value])
  return (
    <div className="ciam-enabled">
      <DSFormGroup controlId="form-control-id">
        <DSFormLabel>Form input label</DSFormLabel>
        <CIAMSixDigitsInput
          id="form-control-id"
          {...args}
          value={state}
          onChange={e => setState(e.target.value)}
        />
      </DSFormGroup>
    </div>
  )
}

const meta: Meta<typeof SixDigitsInput> = {
  title: 'Shared / DS Components',
  component: SixDigitsInput,
  argTypes: {
    value: { control: 'text' },
  },
  parameters: {
    controls: {
      include: ['value'],
    },
    ...figmaDesignUrl(
      'https://www.figma.com/design/aJQlecvqCS9Ry8b6JA1lQN/DS---Components?node-id=6318-428&t=pcx9KKzhlzpRmA4S-0'
    ),
  },
}

export default meta
