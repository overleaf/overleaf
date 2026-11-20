import type { DefaultNavbarMetadata } from '@/shared/components/types/default-navbar-metadata'
import getMeta from '@/utils/meta'
import overleafGreenLogo from '@/shared/svgs/overleaf-green.svg'
import overleafWhiteLogo from '@/shared/svgs/overleaf-white.svg'

const LEGACY_PLACEHOLDER_TITLES = new Set([
  'Our Overleaf Instance',
  'Overleaf Community Edition',
  'Overleaf (Community Edition)',
])

function isDarkNavbarContext() {
  if (typeof document === 'undefined') return true
  const isRedesign =
    document.body.classList.contains('website-redesign') ||
    Boolean(
      document.querySelector('.website-redesign, .website-redesign-navbar')
    )
  if (!isRedesign) return true
  const isDashboardRoot = Boolean(
    document.getElementById('project-list-root') ||
      document.getElementById('library-root')
  )
  const activeTheme =
    document.body.dataset.theme || document.body.dataset.initialTheme
  return isDashboardRoot && activeTheme !== 'light'
}

export default function HeaderLogoOrTitle({
  overleafLogo,
  customLogo,
  title,
}: Pick<DefaultNavbarMetadata, 'customLogo' | 'title'> & {
  overleafLogo?: string
}) {
  const appName = getMeta('ol-ExposedSettings')?.appName
  const effectiveTitle =
    title && !LEGACY_PLACEHOLDER_TITLES.has(title.trim()) ? title : undefined
  const organizationName = getMeta('ol-navbar')?.organizationName
  const brandLabel =
    organizationName ||
    (appName && !LEGACY_PLACEHOLDER_TITLES.has(appName.trim())
      ? appName
      : 'Overleaf')
  const fallbackLogo = isDarkNavbarContext()
    ? overleafWhiteLogo
    : overleafGreenLogo
  const logoUrl = customLogo ?? overleafLogo ?? fallbackLogo

  return (
    <a href="/" aria-label={brandLabel} className="navbar-brand">
      {(customLogo || !effectiveTitle) && (
        <div
          className="navbar-logo"
          style={
            logoUrl ? { backgroundImage: `url("${logoUrl}")` } : undefined
          }
        />
      )}
      {effectiveTitle && (
        <div className="navbar-title">
          <span>{effectiveTitle}</span>
        </div>
      )}
    </a>
  )
}
