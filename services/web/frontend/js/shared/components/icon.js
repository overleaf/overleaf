import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'

function Icon({ type, spin, modifier, classes = {}, accessibilityLabel }) {
  const iconClassName = classNames(
    'fa',
    `fa-${type}`,
    {
      'fa-spin': spin,
      [`fa-${modifier}`]: modifier
    },
    classes.icon
  )

  return (
    <>
      <i className={iconClassName} aria-hidden="true" />
      {accessibilityLabel ? (
        <span className="sr-only">{accessibilityLabel}</span>
      ) : null}
    </>
  )
}

Icon.propTypes = {
  type: PropTypes.string.isRequired,
  spin: PropTypes.bool,
  modifier: PropTypes.string,
  classes: PropTypes.exact({
    icon: PropTypes.string
  }),
  accessibilityLabel: PropTypes.string
}

export default Icon
