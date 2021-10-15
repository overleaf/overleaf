import { createContext, useContext, useCallback, useMemo } from 'react'
import PropTypes from 'prop-types'
import useScopeValue from '../hooks/use-scope-value'
import { useIdeContext } from './ide-context'
import localStorage from '../../infrastructure/local-storage'

export const LayoutContext = createContext()

LayoutContext.Provider.propTypes = {
  value: PropTypes.shape({
    view: PropTypes.string,
    setView: PropTypes.func.isRequired,
    chatIsOpen: PropTypes.bool,
    setChatIsOpen: PropTypes.func.isRequired,
    reviewPanelOpen: PropTypes.bool,
    setReviewPanelOpen: PropTypes.func.isRequired,
    leftMenuShown: PropTypes.bool,
    setLeftMenuShown: PropTypes.func.isRequired,
    pdfLayout: PropTypes.oneOf(['sideBySide', 'flat']).isRequired,
  }).isRequired,
}

export function LayoutProvider({ children }) {
  const { $scope } = useIdeContext()

  // what to show in the "flat" view (editor or pdf)
  const [view, _setView] = useScopeValue('ui.view')

  const setView = useCallback(
    value => {
      _setView(oldValue => {
        // ensure that the "history:toggle" event is broadcast when switching in or out of history view
        if (value === 'history' || oldValue === 'history') {
          $scope.toggleHistory()
        }

        return value
      })
    },
    [$scope, _setView]
  )

  // whether the chat pane is open
  const [chatIsOpen, setChatIsOpen] = useScopeValue('ui.chatOpen')

  // whether the review pane is open
  const [reviewPanelOpen, setReviewPanelOpen] = useScopeValue(
    'ui.reviewPanelOpen'
  )

  // whether the menu pane is open
  const [leftMenuShown, setLeftMenuShown] = useScopeValue('ui.leftMenuShown')

  // whether to display the editor and preview side-by-side or full-width ("flat")
  const [pdfLayout, setPdfLayout] = useScopeValue('ui.pdfLayout')

  // switch to either side-by-side or flat (full-width) layout
  const switchLayout = useCallback(() => {
    setPdfLayout(layout => {
      const newLayout = layout === 'sideBySide' ? 'flat' : 'sideBySide'
      setView(newLayout === 'sideBySide' ? 'editor' : 'pdf')
      setPdfLayout(newLayout)
      localStorage.setItem('pdf.layout', newLayout)
    })
  }, [setPdfLayout, setView])

  const value = useMemo(
    () => ({
      chatIsOpen,
      leftMenuShown,
      pdfLayout,
      reviewPanelOpen,
      setChatIsOpen,
      setLeftMenuShown,
      setPdfLayout,
      setReviewPanelOpen,
      setView,
      switchLayout,
      view,
    }),
    [
      chatIsOpen,
      leftMenuShown,
      pdfLayout,
      reviewPanelOpen,
      setChatIsOpen,
      setLeftMenuShown,
      setPdfLayout,
      setReviewPanelOpen,
      setView,
      switchLayout,
      view,
    ]
  )

  return (
    <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
  )
}

LayoutProvider.propTypes = {
  children: PropTypes.any,
}

export function useLayoutContext(propTypes) {
  const data = useContext(LayoutContext)
  PropTypes.checkPropTypes(propTypes, data, 'data', 'LayoutContext.Provider')
  return data
}
