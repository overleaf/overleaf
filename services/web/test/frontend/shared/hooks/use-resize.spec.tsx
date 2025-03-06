import {
  usePersistedResize,
  useResize,
} from '../../../../frontend/js/shared/hooks/use-resize'

function Template({
  mousePos,
  getTargetProps,
  getHandleProps,
}: ReturnType<typeof useResize>) {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div style={{ position: 'relative' }}>
        <div
          id="target"
          {...getTargetProps({
            style: {
              width: '200px',
              height: '200px',
              border: '2px solid black',
              ...(mousePos?.x && { width: `${mousePos.x}px` }),
            },
          })}
        >
          Demo content demo content demo content demo content demo content demo
          content
        </div>
        <div
          id="handle"
          {...getHandleProps({
            style: {
              position: 'absolute',
              top: 0,
              right: 0,
              height: '100%',
              width: '4px',
              backgroundColor: 'red',
            },
          })}
        />
      </div>
    </div>
  )
}

function PersistedResizeTest() {
  const props = usePersistedResize({ name: 'test' })

  return <Template {...props} />
}

function ResizeTest() {
  const props = useResize()

  return <Template {...props} />
}

describe('useResize', function () {
  it('should apply provided styles to the target', function () {
    cy.mount(<ResizeTest />)

    // test a css prop being applied
    cy.get('#target').should('have.css', 'width', '200px')
  })

  it('should apply provided styles to the handle', function () {
    cy.mount(<ResizeTest />)

    // test a css prop being applied
    cy.get('#handle').should('have.css', 'width', '4px')
  })

  it('should apply default styles to the handle', function () {
    cy.mount(<ResizeTest />)

    cy.get('#handle')
      .should('have.css', 'cursor', 'col-resize')
      .and('have.css', 'user-select', 'none')
  })

  it('should resize the target horizontally on mousedown and mousemove', function () {
    const xPos = 400
    cy.mount(<ResizeTest />)

    cy.get('#handle').trigger('mousedown', { button: 0 })
    cy.get('#handle').trigger('mousemove', { clientX: xPos })
    cy.get('#handle').trigger('mouseup')

    cy.get('#target').should('have.css', 'width', `${xPos}px`)
  })

  it('should persist the resize data', function () {
    const xPos = 400
    cy.mount(<PersistedResizeTest />)

    cy.get('#handle').trigger('mousedown', { button: 0 })
    cy.get('#handle').trigger('mousemove', { clientX: xPos })
    cy.get('#handle').trigger('mouseup')

    cy.window()
      .its('localStorage.resizeable-test')
      .should('eq', `{"x":${xPos}}`)

    // render the component again
    cy.mount(<PersistedResizeTest />)

    cy.get('#target').should('have.css', 'width', `${xPos}px`)
  })
})
