import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useEffect,
} from 'react'
import PropTypes from 'prop-types'
import useScopeValue from '../hooks/use-scope-value'
import usePreviousValue from '../hooks/use-previous-value'
import useDetachLayout from '../hooks/use-detach-layout'
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

function setLayoutInLocalStorage(pdfLayout) {
  localStorage.setItem(
    'pdf.layout',
    pdfLayout === 'sideBySide' ? 'split' : 'flat'
  )
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
      setLayoutInLocalStorage(newLayout)
    })
  }, [setPdfLayout, setView])

  const changeLayout = useCallback(
    (newLayout, newView) => {
      setPdfLayout(newLayout)
      setView(newLayout === 'sideBySide' ? 'editor' : newView)
      setLayoutInLocalStorage(newLayout)
    },
    [setPdfLayout, setView]
  )

  const {
    reattach,
    detach,
    mode: detachMode,
    role: detachRole,
  } = useDetachLayout()
  const previousDetachMode = usePreviousValue(detachMode)

  useEffect(() => {
    switch (detachMode) {
      case 'detacher':
        changeLayout('flat', 'editor')
        break
      case 'detaching':
        changeLayout('flat', 'editor')
        break
      case 'detached':
        break
      case 'orphan':
        break
      case null:
        if (previousDetachMode) {
          changeLayout('sideBySide')
        }
        break
    }
  }, [detachMode, previousDetachMode, changeLayout])

  const value = useMemo(
    () => ({
      reattach,
      detach,
      detachMode,
      detachRole,
      changeLayout,
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
      reattach,
      detach,
      detachMode,
      detachRole,
      changeLayout,
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
