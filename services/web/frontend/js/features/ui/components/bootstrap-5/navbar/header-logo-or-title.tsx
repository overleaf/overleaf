import type { DefaultNavbarMetadata } from '@/features/ui/components/types/default-navbar-metadata'
import getMeta from '@/utils/meta'

export default function HeaderLogoOrTitle({
  customLogo,
  title,
}: Pick<DefaultNavbarMetadata, 'customLogo' | 'title'>) {
  const { appName } = getMeta('ol-ExposedSettings')

  if (customLogo) {
    return (
      // eslint-disable-next-line jsx-a11y/anchor-has-content
      <a
        href="/"
        aria-label={appName}
        className="navbar-brand"
        style={{ backgroundImage: `url("${customLogo}")` }}
      />
    )
  } else if (title) {
    return (
      <a href="/" aria-label={appName} className="navbar-title">
        {title}
      </a>
    )
  } else {
    return (
      // eslint-disable-next-line jsx-a11y/anchor-has-content
      <a href="/" aria-label={appName} className="navbar-brand" />
    )
  }
}
