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

  it('renders inline code', function () {
    const { container } = render(
      <LabsDescription description="Set the `foo` option." />
    )

    const code = container.querySelector('code')
    expect(code?.textContent).to.equal('foo')
    expect(code?.parentElement?.nodeName).to.equal('P')
  })

  it('renders fenced code blocks without the language class', function () {
    const { container } = render(
      <LabsDescription description={'```js\nconst foo = 1\n```'} />
    )

    const code = container.querySelector('pre > code')
    expect(code?.textContent).to.equal('const foo = 1\n')
    expect(code?.getAttribute('class')).to.equal(null)
  })

  it('renders indented code blocks', function () {
    const { container } = render(
      <LabsDescription description="    const foo = 1" />
    )

    const code = container.querySelector('pre > code')
    expect(code?.textContent).to.equal('const foo = 1\n')
  })

  // The visual hierarchy between the levels is in labs.scss, which the jsdom
  // suite does not load, so this only covers each level surviving sanitization
  it('renders headings at every level', function () {
    const levels = [1, 2, 3, 4, 5, 6]
    const { container } = render(
      <LabsDescription
        description={levels
          .map(level => `${'#'.repeat(level)} Level ${level}`)
          .join('\n\n')}
      />
    )

    for (const level of levels) {
      expect(container.querySelector(`h${level}`)?.textContent).to.equal(
        `Level ${level}`
      )
    }
  })

  it('escapes HTML inside code', function () {
    const { container } = render(
      <LabsDescription description="Use `<script>alert(1)</script>` here." />
    )

    expect(container.querySelector('script')).to.equal(null)
    expect(container.querySelector('code')?.textContent).to.equal(
      '<script>alert(1)</script>'
    )
  })

  it('strips tags outside the supported subset', function () {
    const { container } = render(
      <LabsDescription description='<img src=x onerror="alert(1)">' />
    )

    expect(container.querySelector('img')).to.equal(null)
  })
})
