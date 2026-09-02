import { renderHook } from '@testing-library/react'
import { expect } from 'chai'
import sinon from 'sinon'
import useScrollIntoView from '../../../../frontend/js/shared/hooks/use-scroll-into-view'

describe('useScrollIntoView', function () {
  function createTargetElement({ id, top }: { id: string; top: number }) {
    const element = document.createElement('div')
    element.id = id
    Object.defineProperty(element, 'clientHeight', {
      configurable: true,
      value: 20,
    })
    sinon.stub(element, 'getBoundingClientRect').returns({
      top,
      bottom: top + 20,
    } as DOMRect)
    document.body.appendChild(element)
    return element
  }

  afterEach(function () {
    sinon.restore()
    document.body.innerHTML = ''
  })

  it('does not scroll on the initial render', function () {
    createTargetElement({ id: 'target-1', top: 10000 })
    const scrollIntoViewStub = sinon.stub(
      globalThis.HTMLElement.prototype,
      'scrollIntoView'
    )

    renderHook(() => useScrollIntoView({ id: 'target-1' }))

    expect(scrollIntoViewStub.called).to.be.false
  })

  it('scrolls when id changes and the target is out of view', function () {
    createTargetElement({ id: 'target-1', top: 10000 })
    createTargetElement({ id: 'target-2', top: 10000 })
    const scrollIntoViewStub = sinon.stub(
      globalThis.HTMLElement.prototype,
      'scrollIntoView'
    )

    const { rerender } = renderHook(
      ({ id }: { id: string }) => useScrollIntoView({ id }),
      {
        initialProps: { id: 'target-1' },
      }
    )

    rerender({ id: 'target-2' })

    expect(scrollIntoViewStub.calledOnceWithExactly({ behavior: 'smooth' })).to
      .be.true
  })

  it('does not scroll when id changes and the target is already in view', function () {
    createTargetElement({ id: 'target-1', top: 10000 })
    createTargetElement({ id: 'target-2', top: 10 })
    const scrollIntoViewStub = sinon.stub(
      globalThis.HTMLElement.prototype,
      'scrollIntoView'
    )

    const { rerender } = renderHook(
      ({ id }: { id: string }) => useScrollIntoView({ id }),
      {
        initialProps: { id: 'target-1' },
      }
    )

    rerender({ id: 'target-2' })

    expect(scrollIntoViewStub.called).to.be.false
  })
})
