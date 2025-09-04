function ZoteroLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      version="1.1"
      id="svg5"
      xmlSpace="preserve"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs id="defs2" />
      <g id="layer1">
        <image
          width="40"
          height="40"
          preserveAspectRatio="none"
          xlinkHref="data:image/png;base64,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"
          id="image376"
          x="0"
          y="0"
        />
      </g>
    </svg>
  )
}

export default ZoteroLogo
