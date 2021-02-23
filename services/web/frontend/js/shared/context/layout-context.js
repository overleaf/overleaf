import React, { createContext, useContext } from 'react'
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
    setLeftMenuShown: PropTypes.func.isRequired
  }).isRequired
}

export function LayoutProvider({ children, $scope }) {
  const [view, setView] = useScopeValue('ui.view', $scope)
  const [chatIsOpen, setChatIsOpen] = useScopeValue('ui.chatOpen', $scope)
  const [reviewPanelOpen, setReviewPanelOpen] = useScopeValue(
    'ui.reviewPanelOpen',
    $scope
  )
  const [leftMenuShown, setLeftMenuShown] = useScopeValue(
    'ui.leftMenuShown',
    $scope
  )

  const layoutContextValue = {
    view,
    setView,
    chatIsOpen,
    setChatIsOpen,
    reviewPanelOpen,
    setReviewPanelOpen,
    leftMenuShown,
    setLeftMenuShown
  }

  return (
    <LayoutContext.Provider value={layoutContextValue}>
      {children}
    </LayoutContext.Provider>
  )
}

LayoutProvider.propTypes = {
  children: PropTypes.any,
  $scope: PropTypes.any.isRequired
}

export function useLayoutContext(propTypes) {
  const data = useContext(LayoutContext)
  PropTypes.checkPropTypes(propTypes, data, 'data', 'LayoutContext.Provider')
  return data
}
