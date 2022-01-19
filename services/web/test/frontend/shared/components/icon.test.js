import { expect } from 'chai'
import { screen, render } from '@testing-library/react'

import Icon from '../../../../frontend/js/shared/components/icon'

describe('<Icon />', function () {
  it('renders basic fa classes', function () {
    const { container } = render(<Icon type="angle-down" />)
    const element = container.querySelector('i.fa.fa-angle-down')
    expect(element).to.exist
  })

  it('renders with aria-hidden', function () {
    const { container } = render(<Icon type="angle-down" />)
    const element = container.querySelector('i[aria-hidden="true"]')
    expect(element).to.exist
  })

  it('renders accessible label', function () {
    render(<Icon type="angle-down" accessibilityLabel="Accessible Foo" />)
    screen.getByText('Accessible Foo')
  })

  it('renders with spin', function () {
    const { container } = render(<Icon type="angle-down" spin />)
    const element = container.querySelector('i.fa.fa-angle-down.fa-spin')
    expect(element).to.exist
  })

  it('renders with fw', function () {
    const { container } = render(<Icon type="angle-down" fw />)
    const element = container.querySelector('i.fa.fa-angle-down.fa-fw')
    expect(element).to.exist
  })

  it('renders with modifier', function () {
    const { container } = render(<Icon type="angle-down" modifier="2x" />)
    const element = container.querySelector('i.fa.fa-angle-down.fa-2x')
    expect(element).to.exist
  })

  it('renders with custom clases', function () {
    const { container } = render(
      <Icon type="angle-down" className="custom-icon-class" />
    )
    const element = container.querySelector(
      'i.fa.fa-angle-down.custom-icon-class'
    )
    expect(element).to.exist
  })
})
