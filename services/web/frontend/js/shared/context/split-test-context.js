import { createContext, useContext, useMemo } from 'react'
import PropTypes from 'prop-types'
import getMeta from '../../utils/meta'

export const SplitTestContext = createContext()

SplitTestContext.Provider.propTypes = {
  value: PropTypes.shape({
    splitTestVariants: PropTypes.object.isRequired,
  }),
}

export function SplitTestProvider({ children }) {
  const value = useMemo(
    () => ({
      splitTestVariants: getMeta('ol-splitTestVariants') || {},
    }),
    []
  )

  return (
    <SplitTestContext.Provider value={value}>
      {children}
    </SplitTestContext.Provider>
  )
}

SplitTestProvider.propTypes = {
  children: PropTypes.any,
}

export function useSplitTestContext(propTypes) {
  const context = useContext(SplitTestContext)

  PropTypes.checkPropTypes(
    propTypes,
    context,
    'data',
    'SplitTestContext.Provider'
  )

  return context
}
