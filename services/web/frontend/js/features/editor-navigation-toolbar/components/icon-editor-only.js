function IconEditorOnly() {
  const color = '#505050' // match color from .dropdown-menu > li > a

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="0.5"
        y="1.5769"
        width="15"
        height="13.7692"
        rx="1.5"
        stroke={color}
      />
      <line x1="1" y1="2.49976" x2="15" y2="2.49976" stroke={color} />
      <line
        x1="14"
        y1="2.99976"
        x2="14"
        y2="14.9998"
        stroke={color}
        strokeWidth="2"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.74946 5.26853L10.7397 8.35194C11.0868 8.70989 11.0868 9.29025 10.7397 9.6482L7.74946 12.7316C7.40233 13.0896 6.83952 13.0896 6.49238 12.7316C6.14525 12.3736 6.51344 11.7904 6.86057 11.4324L8.33333 9.91374L3.88889 9.91667C3.39797 9.91667 3 9.50629 3 9.00007C3 8.49385 3.39797 8.08347 3.88889 8.08347L8.33333 8.08054L6.86057 6.56187C6.51344 6.20392 6.14525 5.62649 6.49238 5.26853C6.83952 4.91058 7.40233 4.91058 7.74946 5.26853Z"
        fill={color}
      />
    </svg>
  )
}

export default IconEditorOnly
