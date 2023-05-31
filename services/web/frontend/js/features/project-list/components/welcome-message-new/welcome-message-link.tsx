type WelcomeMessageLinkProps = {
  imgSrc: string
  title: string
  href: string
  onClick?: () => void
}

export default function WelcomeMessageLink({
  imgSrc,
  title,
  href,
  onClick,
}: WelcomeMessageLinkProps) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="card welcome-message-card welcome-message-card-link"
    >
      <p>{title}</p>
      <img
        className="welcome-message-card-img"
        src={imgSrc}
        alt={title}
        aria-hidden="true"
      />
    </a>
  )
}
