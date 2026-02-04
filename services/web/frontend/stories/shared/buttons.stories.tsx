import { Meta, StoryObj } from '@storybook/react'
import OLButton from '@/shared/components/ol/ol-button'
import { ButtonProps } from '@/shared/components/types/button-props'

export default {
  title: 'Shared / Components / Button',
  component: OLButton,
} satisfies Meta

type Story = StoryObj<typeof OLButton>

const variants: ButtonProps['variant'][] = [
  'primary',
  'secondary',
  'ghost',
  'danger',
  'danger-ghost',
  'premium',
  'premium-secondary',
  'link',
]

export const Variants: Story = {
  render() {
    return (
      <>
        <div className="d-flex flex-column gap-2 p-4">
          {variants.map(variant => (
            <div key={variant} className="d-flex gap-2">
              <OLButton variant={variant}>Button</OLButton>
              <OLButton variant={variant} isLoading>
                Button
              </OLButton>
              <OLButton variant={variant} disabled>
                Button
              </OLButton>
              <OLButton variant={variant} size="sm">
                Button
              </OLButton>
            </div>
          ))}
        </div>
        <h1> Dark Mode</h1>
        <br />
        <div
          className="d-flex flex-column gap-2 p-4 ide-redesign-main"
          data-theme="default"
          style={{ backgroundColor: '#2f3a4c' }}
        >
          {variants.map(variant => (
            <div key={variant} className="d-flex gap-2">
              <OLButton variant={variant}>Button</OLButton>
              <OLButton variant={variant} isLoading>
                Button
              </OLButton>
              <OLButton variant={variant} disabled>
                Button
              </OLButton>
              <OLButton variant={variant} size="sm">
                Button
              </OLButton>
            </div>
          ))}
        </div>
      </>
    )
  },
}
