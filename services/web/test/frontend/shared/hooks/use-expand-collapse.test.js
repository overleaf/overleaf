import PropTypes from 'prop-types'
import { expect } from 'chai'
import { render } from '@testing-library/react'

import useExpandCollapse from '../../../../frontend/js/shared/hooks/use-expand-collapse'

const sampleContent = (
  <div>
    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
    <p>Maecenas maximus ultrices sollicitudin.</p>
    <p>Praesent mollis arcu eget molestie viverra.</p>
    <p>Pellentesque eget molestie nisl, non hendrerit lectus.</p>
  </div>
)

const originalScrollHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetHeight'
)
const originalScrollWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetWidth'
)

function ExpandCollapseTestUI({ expandCollapseArgs }) {
  const { expandableProps } = useExpandCollapse(expandCollapseArgs)
  return (
    <>
      <div {...expandableProps}>{sampleContent}</div>
    </>
  )
}
ExpandCollapseTestUI.propTypes = {
  expandCollapseArgs: PropTypes.object,
}

describe('useExpandCollapse', function () {
  // JSDom doesn't compute layout/sizing, so we need to simulate sizing for the elements
  // Here we are simulating that the content is bigger than the `collapsedSize`, so
  // the expand-collapse widget is used
  beforeEach(function () {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      value: 500,
    })
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      value: 500,
    })
  })

  afterEach(function () {
    Object.defineProperty(
      HTMLElement.prototype,
      'scrollHeight',
      originalScrollHeight
    )
    Object.defineProperty(
      HTMLElement.prototype,
      'scrollWidth',
      originalScrollWidth
    )
  })

  describe('custom CSS classes', function () {
    it('supports a custom CSS class', function () {
      const testArgs = {
        classes: {
          container: 'my-custom-class',
        },
      }
      const { container } = render(
        <ExpandCollapseTestUI expandCollapseArgs={testArgs} />
      )
      const elWithCustomCSSClass = container.querySelector('div')
      expect(elWithCustomCSSClass).to.exist
    })
    it('supports an extra custom CSS class for the collapsed state', function () {
      const testArgs = {
        classes: {
          containerCollapsed: 'my-custom-collapsed-class',
        },
      }

      const { container } = render(
        <ExpandCollapseTestUI expandCollapseArgs={testArgs} />
      )
      const elWithCustomCollapsedCSSClass = container.querySelector(
        '.my-custom-collapsed-class'
      )
      expect(elWithCustomCollapsedCSSClass).to.exist
    })
    it('ignores the collapsed CSS class when expanded', function () {
      const testArgs = {
        initiallyExpanded: true,
        classes: {
          containerCollapsed: 'my-custom-collapsed-class',
        },
      }
      const { container } = render(
        <ExpandCollapseTestUI expandCollapseArgs={testArgs} />
      )
      const elWithCustomCollapsedCSSClass = container.querySelector(
        '.my-custom-collapsed-class'
      )
      expect(elWithCustomCollapsedCSSClass).to.not.exist
    })
  })
  describe('height and width support via dimension argument', function () {
    it('defaults to height', function () {
      const { container } = render(<ExpandCollapseTestUI />)
      const expandCollapseEl = container.firstChild
      expect(expandCollapseEl.style.height).to.not.be.empty
      expect(expandCollapseEl.style.width).to.be.empty
    })
    it('supports width', function () {
      const testArgs = {
        dimension: 'width',
      }
      const { container } = render(
        <ExpandCollapseTestUI expandCollapseArgs={testArgs} />
      )
      const expandCollapseEl = container.firstChild
      expect(expandCollapseEl.style.height).to.be.empty
      expect(expandCollapseEl.style.width).to.not.be.empty
    })
  })
  describe('collapsed size support via collapsedSize argument', function () {
    it('defaults to 0px', function () {
      const { container } = render(<ExpandCollapseTestUI />)
      const expandCollapseEl = container.firstChild
      expect(expandCollapseEl.style.height).to.equal('0px')
    })
    it('supports a custom collapsed size', function () {
      const testArgs = {
        collapsedSize: 200,
      }
      const { container } = render(
        <ExpandCollapseTestUI expandCollapseArgs={testArgs} />
      )
      const expandCollapseEl = container.firstChild
      expect(expandCollapseEl.style.height).to.equal('200px')
    })
    it('supports a custom collapsed size for width', function () {
      const testArgs = {
        collapsedSize: 200,
        dimension: 'width',
      }
      const { container } = render(
        <ExpandCollapseTestUI expandCollapseArgs={testArgs} />
      )
      const expandCollapseEl = container.firstChild
      expect(expandCollapseEl.style.height).to.be.empty
      expect(expandCollapseEl.style.width).to.equal('200px')
    })
  })
})
