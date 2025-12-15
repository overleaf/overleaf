import { useActiveEditorTheme } from '@/shared/hooks/use-active-editor-theme'
import { EditorProviders } from '../../helpers/editor-providers'
import { SplitTestProvider } from '@/shared/context/split-test-context'

const MOCK_IEEE_BRAND_ID = 123

const TestComponent = ({ overallTheme }: { overallTheme: string }) => {
  return (
    <SplitTestProvider>
      <EditorProviders
        userSettings={{
          overallTheme,
          editorTheme: 'default-theme',
          editorLightTheme: 'light-theme',
          editorDarkTheme: 'dark-theme',
        }}
      >
        <TestComponentInner />
      </EditorProviders>
    </SplitTestProvider>
  )
}

const TestComponentInner = () => {
  const editorTheme = useActiveEditorTheme()
  return <div data-testid="editor-theme">{editorTheme}</div>
}

describe('useActiveEditorTheme', function () {
  describe('when overall theme is specific mode', function () {
    it('Uses editorTheme when in dark mode', function () {
      cy.mount(<TestComponent overallTheme="" />)
      cy.findByTestId('editor-theme').should('have.text', 'default-theme')
    })

    it('Uses editorTheme when in light mode', function () {
      cy.mount(<TestComponent overallTheme="light-" />)
      cy.findByTestId('editor-theme').should('have.text', 'default-theme')
    })
  })

  describe('when overall theme is system', function () {
    function stubMediaQuery(prefersDark: boolean, isIEEE = false) {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-brandVariation', {
          brand_id: isIEEE ? MOCK_IEEE_BRAND_ID : undefined,
        })
        win.metaAttributesCache.get('ol-ExposedSettings').ieeeBrandId =
          MOCK_IEEE_BRAND_ID
        cy.stub(win, 'matchMedia')
          .withArgs('(prefers-color-scheme: dark)')
          .returns({
            matches: prefersDark,
            addEventListener: () => {},
            removeEventListener: () => {},
          } as any)
      })
    }

    it('uses editorDarkTheme when in dark mode', function () {
      stubMediaQuery(true)
      cy.mount(<TestComponent overallTheme="system" />)
      cy.findByTestId('editor-theme').should('have.text', 'dark-theme')
    })

    it('uses editorLightTheme when in light mode', function () {
      stubMediaQuery(false)
      cy.mount(<TestComponent overallTheme="system" />)
      cy.findByTestId('editor-theme').should('have.text', 'light-theme')
    })

    it('uses editorTheme when in IEEE document', function () {
      stubMediaQuery(false, true)
      cy.mount(<TestComponent overallTheme="system" />)
      cy.findByTestId('editor-theme').should('have.text', 'default-theme')
    })
  })
})
