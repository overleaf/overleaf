import { render, screen } from '@testing-library/react'
import { expect } from 'chai'
import PdfCompileTime from '../../../../frontend/js/features/pdf-preview/components/pdf-compile-time'
import { DetachCompileContext } from '../../../../frontend/js/shared/context/detach-compile-context'

function renderComponent(compileTimeClientE2E?: number) {
  return render(
    <DetachCompileContext.Provider
      value={
        {
          compiling: false,
          deliveryLatencies: {
            compileTimeClientE2E,
          },
        } as any
      }
    >
      <PdfCompileTime />
    </DetachCompileContext.Provider>
  )
}

describe('<PdfCompileTime />', function () {
  it('does not render when compile duration is missing', function () {
    renderComponent(undefined)

    expect(screen.queryByText('1.2 s')).to.not.exist
  })

  it('renders when compile duration is available', function () {
    renderComponent(1200)

    screen.getByText('1.2 s')
  })

  it('renders a running timer while compiling', function () {
    render(
      <DetachCompileContext.Provider
        value={
          {
            compiling: true,
            deliveryLatencies: {},
          } as any
        }
      >
        <PdfCompileTime />
      </DetachCompileContext.Provider>
    )

    screen.getByText('0.0 s')
  })
})
