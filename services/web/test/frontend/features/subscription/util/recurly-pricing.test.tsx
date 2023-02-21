import { expect } from 'chai'
import { formatPriceForDisplayData } from '../../../../../frontend/js/features/subscription/util/recurly-pricing'

describe('formatPriceForDisplayData', function () {
  beforeEach(function () {
    window.metaAttributesCache = new Map()
  })
  afterEach(function () {
    window.metaAttributesCache = new Map()
  })
  it('should handle no tax rate', function () {
    const data = formatPriceForDisplayData('1000', 0, 'USD')
    expect(data).to.deep.equal({
      totalForDisplay: '$1000',
      totalAsNumber: 1000,
      subtotal: '$1000.00',
      tax: '$0.00',
      includesTax: false,
    })
    window.metaAttributesCache = new Map()
  })

  it('should handle a tax rate', function () {
    const data = formatPriceForDisplayData('380', 0.2, 'EUR')
    expect(data).to.deep.equal({
      totalForDisplay: '€456',
      totalAsNumber: 456,
      subtotal: '€380.00',
      tax: '€76.00',
      includesTax: true,
    })
  })

  it('should handle total with cents', function () {
    const data = formatPriceForDisplayData('8', 0.2, 'EUR')
    expect(data).to.deep.equal({
      totalForDisplay: '€9.60',
      totalAsNumber: 9.6,
      subtotal: '€8.00',
      tax: '€1.60',
      includesTax: true,
    })
  })
})
