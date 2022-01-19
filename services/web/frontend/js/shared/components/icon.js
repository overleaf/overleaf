import PropTypes from 'prop-types'
import classNames from 'classnames'

/**
 * @param {string} type
 * @param {boolean} [spin]
 * @param {boolean} [fw]
 * @param {string} [modifier]
 * @param {string} [className]
 * @param {string} [accessibilityLabel]
 * @return {JSX.Element}
 */
function Icon({
  type,
  spin,
  fw,
  modifier,
  className = '',
  accessibilityLabel,
}) {
  const iconClassName = classNames(
    'fa',
    `fa-${type}`,
    {
      'fa-spin': spin,
      'fa-fw': fw,
      [`fa-${modifier}`]: modifier,
    },
    className
  )

  return (
    <>
      <i className={iconClassName} aria-hidden="true" />
      {accessibilityLabel && (
        <span className="sr-only">{accessibilityLabel}</span>
      )}
    </>
  )
}

Icon.propTypes = {
  type: PropTypes.string.isRequired,
  spin: PropTypes.bool,
  fw: PropTypes.bool,
  modifier: PropTypes.string,
  className: PropTypes.string,
  accessibilityLabel: PropTypes.string,
}

export default Icon
