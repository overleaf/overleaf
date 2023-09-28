import PropTypes from 'prop-types'

function CobrandingLogo({
  brandVariationHomeUrl,
  brandVariationName,
  logoImgUrl,
}) {
  return (
    <a
      className="btn btn-full-height header-cobranding-logo-container"
      href={brandVariationHomeUrl}
      target="_blank"
      rel="noreferrer noopener"
    >
      <img
        src={logoImgUrl}
        className="header-cobranding-logo"
        alt={brandVariationName}
      />
    </a>
  )
}

CobrandingLogo.propTypes = {
  brandVariationHomeUrl: PropTypes.string.isRequired,
  brandVariationName: PropTypes.string.isRequired,
  logoImgUrl: PropTypes.string.isRequired,
}

export default CobrandingLogo
