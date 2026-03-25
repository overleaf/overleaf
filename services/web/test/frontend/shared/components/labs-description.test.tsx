import { expect } from 'chai'
import { render } from '@testing-library/react'

import { LabsDescription } from '@/shared/components/labs/labs-description'

describe('<LabsDescription />', function () {
  it('adds rel and target attributes to rendered links', function () {
    const { container } = render(
      <LabsDescription description="A [link](https://example.com)." />
    )

    const link = container.querySelector('a')
    expect(link).to.not.equal(null)
    expect(link?.getAttribute('href')).to.equal('https://example.com')
    expect(link?.getAttribute('rel')).to.equal('noreferrer noopener')
    expect(link?.getAttribute('target')).to.equal('_BLANK')
  })

  it('preserves href sanitization for unsafe links', function () {
    const { container } = render(
      <LabsDescription description="A [link](javascript:alert(1))." />
    )

    const link = container.querySelector('a')
    expect(link).to.not.equal(null)
    expect(link?.getAttribute('href')).to.equal('')
    expect(link?.getAttribute('rel')).to.equal('noreferrer noopener')
    expect(link?.getAttribute('target')).to.equal('_BLANK')
  })
})
