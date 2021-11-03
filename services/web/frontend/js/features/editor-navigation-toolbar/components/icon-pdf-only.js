function IconPdfOnly() {
  const color = '#505050' // match color from .dropdown-menu > li > a

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0.5" y="1.5" width="15" height="14" rx="1.5" stroke={color} />
      <line x1="1" y1="2.5" x2="15" y2="2.5" stroke={color} />
      <line x1="2" y1="3" x2="2" y2="15" stroke={color} strokeWidth="2" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.25054 12.7315L5.26035 9.64806C4.91322 9.29011 4.91322 8.70975 5.26035 8.3518L8.25054 5.2684C8.59767 4.91044 9.16048 4.91044 9.50762 5.2684C9.85475 5.62635 9.48656 6.20964 9.13943 6.56759L7.66667 8.08626L12.1111 8.08333C12.602 8.08333 13 8.49371 13 8.99993C13 9.50615 12.602 9.91653 12.1111 9.91653L7.66667 9.91946L9.13943 11.4381C9.48656 11.7961 9.85475 12.3735 9.50762 12.7315C9.16048 13.0894 8.59767 13.0894 8.25054 12.7315Z"
        fill={color}
      />
    </svg>
  )
}

export default IconPdfOnly
