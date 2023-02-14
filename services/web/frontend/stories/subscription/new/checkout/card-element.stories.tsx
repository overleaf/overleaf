import { useRef } from 'react'
import CardElementComponent from '../../../../js/features/subscription/components/new/checkout/card-element'
import ExternalScriptLoader from '../../../../js/shared/utils/external-script-loader'

export const CardElement = () => {
  const elements = useRef(recurly.Elements())

  return (
    <CardElementComponent elements={elements.current} onChange={() => {}} />
  )
}

export default {
  title: 'Subscription / New / Checkout / Form Fields',
  component: CardElementComponent,
  argTypes: {
    elements: {
      table: {
        disable: true,
      },
    },
    onChange: {
      table: {
        disable: true,
      },
    },
  },
  decorators: [
    (Story: React.ComponentType) => (
      <div
        className="card card-highlighted card-border"
        style={{ maxWidth: '500px' }}
      >
        <ExternalScriptLoader src="https://js.recurly.com/v4/recurly.js">
          <Story />
        </ExternalScriptLoader>
      </div>
    ),
  ],
}
