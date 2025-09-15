import { expect } from 'chai'
import sinon from 'sinon'
import { renderHook } from '@testing-library/react'
import * as CompileContext from '@/shared/context/detach-compile-context'

import { useStatusFavicon } from '@/features/ide-react/hooks/use-status-favicon'

type Compilation = { uncompiled: boolean; compiling: boolean; error: boolean }

describe('useStatusFavicon', function () {
  let mockUseDetachCompileContext: sinon.SinonStub
  let clock: sinon.SinonFakeTimers
  let originalHidden: PropertyDescriptor | undefined

  const setCompilation = (compileContext: Compilation) => {
    mockUseDetachCompileContext.returns(compileContext)
  }
  const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', {
      writable: true,
      configurable: true,
      value: hidden,
    })
    document.dispatchEvent(new Event('visibilitychange'))
  }

  const getFaviconElements = () =>
    document.querySelectorAll('link[data-compile-status="true"]')

  const getCurrentFaviconHref = () => {
    const favicon = document.querySelector(
      'link[data-compile-status="true"]'
    ) as HTMLLinkElement
    return favicon?.href || null
  }

  beforeEach(function () {
    mockUseDetachCompileContext = sinon.stub(
      CompileContext,
      'useDetachCompileContext'
    )

    // Mock timers for timeout testing
    clock = sinon.useFakeTimers()

    // Store original document.hidden descriptor
    originalHidden = Object.getOwnPropertyDescriptor(
      Document.prototype,
      'hidden'
    )

    // Clean up any existing favicon elements
    document
      .querySelectorAll('link[data-compile-status="true"]')
      .forEach(el => el.remove())

    window.metaAttributesCache.set(
      'ol-baseAssetPath',
      'https://cdn.test-overleaf.com/'
    )
  })

  afterEach(function () {
    sinon.restore()
    clock.restore()

    // Restore original document.hidden
    if (originalHidden) {
      Object.defineProperty(document, 'hidden', originalHidden)
    }

    // Clean up favicon elements
    document
      .querySelectorAll('link[data-compile-status="true"]')
      .forEach(el => el.remove())
  })

  it('updates favicon to reflect status: UNCOMPILED', function () {
    setCompilation({ uncompiled: true, compiling: false, error: false })
    renderHook(() => useStatusFavicon())
    expect(getCurrentFaviconHref()).to.include('/favicon.svg')
  })

  it('updates favicon to reflect status: COMPILING', function () {
    setCompilation({ uncompiled: false, compiling: true, error: false })
    renderHook(() => useStatusFavicon())
    expect(getCurrentFaviconHref()).to.include('/favicon-compiling.svg')
  })

  it('updates favicon to reflect status: COMPILED', function () {
    setCompilation({ uncompiled: false, compiling: false, error: false })
    renderHook(() => useStatusFavicon())
    expect(getCurrentFaviconHref()).to.include('/favicon-compiled.svg')
  })

  it('updates favicon to reflect status: ERROR', function () {
    setCompilation({ uncompiled: false, compiling: false, error: true })
    renderHook(() => useStatusFavicon())
    expect(getCurrentFaviconHref()).to.include('/favicon-error.svg')
  })

  it('keeps the COMPILED favicon for 5 seconds when the window is active', function () {
    setCompilation({ uncompiled: false, compiling: false, error: false })
    const { rerender } = renderHook(() => useStatusFavicon())
    setHidden(false)
    rerender()
    expect(getCurrentFaviconHref()).to.include('/favicon-compiled.svg')
    clock.tick(4500)
    expect(getCurrentFaviconHref()).to.include('/favicon-compiled.svg')
    clock.tick(1000)
    expect(getCurrentFaviconHref()).to.include('/favicon.svg')
  })

  it('keeps the COMPILED favicon forever when the window is hidden', function () {
    setCompilation({ uncompiled: false, compiling: false, error: false })
    const { rerender } = renderHook(() => useStatusFavicon())
    setHidden(true)
    rerender()

    expect(getCurrentFaviconHref()).to.include('/favicon-compiled.svg')
    clock.tick(90000)
    expect(getCurrentFaviconHref()).to.include('/favicon-compiled.svg')
  })

  it('should only have one favicon element at a time', function () {
    setCompilation({ uncompiled: true, compiling: false, error: false })
    const { rerender } = renderHook(() => useStatusFavicon())
    expect(getFaviconElements()).to.have.length(1)
    expect(getCurrentFaviconHref()).to.include('/favicon.svg')

    setCompilation({ uncompiled: false, compiling: true, error: false })
    rerender()
    expect(getFaviconElements()).to.have.length(1)
    expect(getCurrentFaviconHref()).to.include('/favicon-compiling.svg')
  })
})
