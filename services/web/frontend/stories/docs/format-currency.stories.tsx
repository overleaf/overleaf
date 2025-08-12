import React from 'react'
import { useSplitTest } from '@/shared/context/split-test-context'
import { withSplitTests } from '../../../.storybook/utils/with-split-tests'

const FormatCurrency = () => {
  const { variant } = useSplitTest('local-ccy-format')
  const formatCurrency = (amount: number, narrowSymbol: boolean) => {
    return variant === 'enabled'
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          currencyDisplay: narrowSymbol ? 'narrowSymbol' : 'name',
        }).format(amount)
      : `USD ${amount}`
  }
  return (
    <div>
      <strong>Variant:</strong> {JSON.stringify(variant)}
      <br />
      <strong>Long:</strong> {formatCurrency(1234.56, false)}
      <br />
      <strong>Short:</strong> {formatCurrency(1234.56, true)}
    </div>
  )
}

const config = {
  title: 'Storybook Guideline / Feature Flags', // Must match MDX title exactly
  component: FormatCurrency,
}

export default {
  ...config,
  ...withSplitTests(config, ['local-ccy-format'], {
    'local-ccy-format': {
      description: 'Use local currency formatting',
      control: { type: 'radio' as const },
      options: ['default', 'enabled'],
    },
  }),
  tags: ['!dev'], // hides in the sidebar
}

export const Story = {}
