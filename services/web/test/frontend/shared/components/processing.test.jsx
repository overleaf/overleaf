import { expect } from 'chai'
import { render } from '@testing-library/react'
import Processing from '../../../../frontend/js/shared/components/processing'

describe('<Processing />', function () {
  it('renders processing UI when isProcessing is true', function () {
    const { container } = render(<Processing isProcessing />)
    const element = container.querySelector('i.fa.fa-refresh')
    expect(element).to.exist
  })
  it('does not render processing UI when isProcessing is false', function () {
    const { container } = render(<Processing isProcessing={false} />)
    const element = container.querySelector('i.fa.fa-refresh')
    expect(element).to.not.exist
  })
})
