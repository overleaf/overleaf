import SubmitButtonComponent from '../../../../js/features/subscription/components/new/checkout/submit-button'

type Args = React.ComponentProps<typeof SubmitButtonComponent>

const Template = (args: Args) => <SubmitButtonComponent {...args} />

export const SubmitButton = Template.bind({}) as typeof Template & {
  args: Args
}
SubmitButton.args = {
  isProcessing: false,
  isFormValid: true,
  children: 'Submit',
}

export const SubmitButtonDisabled = Template.bind({}) as typeof Template & {
  args: Args
}
SubmitButtonDisabled.args = {
  isProcessing: false,
  isFormValid: false,
  children: 'Submit',
}

export const SubmitButtonProcessing = Template.bind({}) as typeof Template & {
  args: Args
}
SubmitButtonProcessing.args = {
  isProcessing: true,
  isFormValid: true,
  children: 'Submit',
}

export default {
  title: 'Subscription / New / Checkout / Submit Button',
  component: SubmitButtonComponent,
  decorators: [
    (Story: React.ComponentType) => (
      <div
        className="card card-highlighted card-border"
        style={{ maxWidth: '500px' }}
      >
        <Story />
      </div>
    ),
  ],
}
