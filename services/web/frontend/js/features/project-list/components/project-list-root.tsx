import { ReactNode, useEffect } from 'react'
import {
  ProjectListProvider,
  useProjectListContext,
} from '../context/project-list-context'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import { ColorPickerProvider } from '../context/color-picker-context'
import * as eventTracking from '../../../infrastructure/event-tracking'
import { useTranslation } from 'react-i18next'
import useWaitForI18n from '../../../shared/hooks/use-wait-for-i18n'
import LoadingBranded from '../../../shared/components/loading-branded'
import SystemMessages from '../../../shared/components/system-messages'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import { GenericErrorBoundaryFallback } from '@/shared/components/generic-error-boundary-fallback'
import getMeta from '@/utils/meta'
import DefaultNavbar from '@/shared/components/navbar/default-navbar'
import Footer from '@/shared/components/footer/footer'
import WelcomePageContent from '@/features/project-list/components/welcome-page-content'
import { ProjectListDsNav } from '@/features/project-list/components/project-list-ds-nav'
import { DsNavStyleProvider } from '@/features/project-list/components/use-is-ds-nav'
import CookieBanner from '@/shared/components/cookie-banner'
import useThemedPage from '@/shared/hooks/use-themed-page'
import { UserSettingsProvider } from '@/shared/context/user-settings-context'

function ProjectListRoot() {
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return <ProjectListRootInner />
}

export function ProjectListRootInner() {
  return (
    <ProjectListProvider>
      <ColorPickerProvider>
        <SplitTestProvider>
          <UserSettingsProvider>
            <ProjectListPageContent />
          </UserSettingsProvider>
        </SplitTestProvider>
      </ColorPickerProvider>
    </ProjectListProvider>
  )
}

function DefaultNavbarAndFooter({ children }: { children: ReactNode }) {
  const navbarProps = getMeta('ol-navbar')
  const footerProps = getMeta('ol-footer')

  return (
    <>
      <DefaultNavbar {...navbarProps} />
      <main
        className="content content-alt project-list-react"
        aria-labelledby="main-content"
      >
        {children}
      </main>
      <Footer {...footerProps} />
    </>
  )
}

function DefaultPageContentWrapper({ children }: { children: ReactNode }) {
  return (
    <DefaultNavbarAndFooter>
      <SystemMessages />
      <div className="project-list-wrapper">{children}</div>
    </DefaultNavbarAndFooter>
  )
}

function ProjectListPageContent() {
  useThemedPage('themed-project-dashboard')
  const { totalProjectsCount, isLoading, loadProgress } =
    useProjectListContext()

  useEffect(() => {
    eventTracking.sendMB('loads_v2_dash', {})
  }, [])

  const { t } = useTranslation()

  if (isLoading) {
    const loadingComponent = (
      <LoadingBranded loadProgress={loadProgress} label={t('loading')} />
    )

    return loadingComponent
  }

  if (totalProjectsCount === 0) {
    return (
      <>
        <DefaultPageContentWrapper>
          <WelcomePageContent />
        </DefaultPageContentWrapper>
        <CookieBanner />
      </>
    )
  }
  return (
    <DsNavStyleProvider>
      <ProjectListDsNav />
    </DsNavStyleProvider>
  )
}

export default withErrorBoundary(ProjectListRoot, () => (
  <GenericErrorBoundaryFallback />
))
