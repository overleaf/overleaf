import React, { createContext, useContext, useCallback } from 'react'
import PropTypes from 'prop-types'
import useScopeValue from './util/scope-value-hook'

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
    pdfLayout: PropTypes.oneOf(['sideBySide', 'flat', 'split']).isRequired,
  }).isRequired,
}

export function LayoutProvider({ children, $scope }) {
  const [view, _setView] = useScopeValue('ui.view', $scope)
  const setView = useCallback(
    value => {
      _setView(value)
      if (value === 'history') {
        $scope.toggleHistory()
      }
    },
    [$scope, _setView]
  )

  const [chatIsOpen, setChatIsOpen] = useScopeValue('ui.chatOpen', $scope)
  const [reviewPanelOpen, setReviewPanelOpen] = useScopeValue(
    'ui.reviewPanelOpen',
    $scope
  )
  const [leftMenuShown, setLeftMenuShown] = useScopeValue(
    'ui.leftMenuShown',
    $scope
  )

  const [pdfLayout] = useScopeValue('ui.pdfLayout', $scope)

  const layoutContextValue = {
    view,
    setView,
    chatIsOpen,
    setChatIsOpen,
    reviewPanelOpen,
    setReviewPanelOpen,
    leftMenuShown,
    setLeftMenuShown,
    pdfLayout,
  }

  return (
    <LayoutContext.Provider value={layoutContextValue}>
      {children}
    </LayoutContext.Provider>
  )
}

LayoutProvider.propTypes = {
  children: PropTypes.any,
  $scope: PropTypes.shape({
    toggleHistory: PropTypes.func.isRequired,
  }).isRequired,
}

export function useLayoutContext(propTypes) {
  const data = useContext(LayoutContext)
  PropTypes.checkPropTypes(propTypes, data, 'data', 'LayoutContext.Provider')
  return data
}
