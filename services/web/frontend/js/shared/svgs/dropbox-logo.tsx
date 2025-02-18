function DropboxLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="40" height="40" fill="white" />
      <g clipPath="url(#clip0_10_138)">
        <path
          d="M10.8328 4.33334L1.6665 10.1732L10.8328 16.0131L20.0006 10.1732L10.8328 4.33334Z"
          fill="#0061FF"
        />
        <path
          d="M29.1668 4.33334L20.0005 10.1732L29.1668 16.0131L38.333 10.1732L29.1668 4.33334Z"
          fill="#0061FF"
        />
        <path
          d="M1.6665 21.853L10.8328 27.6929L20.0006 21.853L10.8328 16.0131L1.6665 21.853Z"
          fill="#0061FF"
        />
        <path
          d="M29.1668 16.0131L20.0005 21.853L29.1668 27.6929L38.333 21.853L29.1668 16.0131Z"
          fill="#0061FF"
        />
        <path
          d="M10.833 29.6395L20.0008 35.4794L29.1671 29.6395L20.0008 23.7996L10.833 29.6395Z"
          fill="#0061FF"
        />
      </g>
      <defs>
        <clipPath id="clip0_10_138">
          <rect
            width="36.6667"
            height="31.146"
            fill="white"
            transform="translate(1.6665 4.33334)"
          />
        </clipPath>
      </defs>
    </svg>
  )
}

export default DropboxLogo
