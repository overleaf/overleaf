import { useActiveOverallTheme } from '@/shared/hooks/use-active-overall-theme'
import getMeta from '@/utils/meta'
import overleafLogo from '@/shared/svgs/overleaf-green.svg'
import overleafLogoDark from '@/shared/svgs/overleaf-white.svg'

export function DsNavOverleafLogo() {
  const appName = getMeta('ol-ExposedSettings')?.appName ?? 'Overleaf'
  const navbarMeta = getMeta('ol-navbar')
  const brandLabel = navbarMeta?.organizationName || appName
  const activeOverallTheme = useActiveOverallTheme()
  const logoSrc =
    activeOverallTheme === 'dark'
      ? navbarMeta?.customLogoDark || navbarMeta?.customLogo || overleafLogoDark
      : navbarMeta?.customLogo || overleafLogo

  return (
    <div className="ds-nav-page-switcher-logo">
      <a href="/" aria-label={brandLabel}>
        <img
          src={logoSrc}
          alt={brandLabel}
          height="38"
          width="130"
          style={{ objectFit: 'contain', objectPosition: 'left center' }}
        />
      </a>
    </div>
  )
}
