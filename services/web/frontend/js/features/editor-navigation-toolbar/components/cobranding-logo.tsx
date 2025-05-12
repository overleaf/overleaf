function CobrandingLogo({
  brandVariationHomeUrl,
  brandVariationName,
  logoImgUrl,
}: {
  brandVariationHomeUrl: string
  brandVariationName: string
  logoImgUrl: string
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

export default CobrandingLogo
