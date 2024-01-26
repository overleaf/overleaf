import {
  FC,
  Ref,
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useEditorContext } from '../../../../../shared/context/editor-context'
import { Button, Overlay, Popover } from 'react-bootstrap'
import Close from '../../../../../shared/components/close'
import { postJSON } from '../../../../../infrastructure/fetch-json'
import { sendMB } from '../../../../../infrastructure/event-tracking'
import { useSplitTestContext } from '../../../../../shared/context/split-test-context'
import { User } from '../../../../../../../types/user'
import { useUserContext } from '../../../../../shared/context/user-context'
import grammarlyExtensionPresent from '../../../../../shared/utils/grammarly'
import { debugConsole } from '../../../../../utils/debugging'

const DELAY_BEFORE_SHOWING_PROMOTION = 1000
const NEW_USER_CUTOFF_TIME = new Date(2023, 8, 20).getTime()
const NOW_TIME = new Date().getTime()
const GRAMMARLY_CUTOFF_TIME = new Date(2023, 9, 10).getTime()

export const PromotionOverlay: FC = ({ children }) => {
  const ref = useRef<HTMLSpanElement>(null)

  const { inactiveTutorials, currentPopup, setCurrentPopup } =
    useEditorContext()
  const {
    splitTestVariants,
  }: { splitTestVariants: Record<string, string | undefined> } =
    useSplitTestContext()

  const user = useUserContext() as User | undefined

  const userRegistrationTime = useMemo(() => {
    if (user?.signUpDate) {
      return new Date(user.signUpDate).getTime()
    }
  }, [user])

  const hideBecauseNewUser =
    !userRegistrationTime || userRegistrationTime > NEW_USER_CUTOFF_TIME

  const popupPresent =
    currentPopup && currentPopup !== 'table-generator-promotion'

  const showPromotion =
    splitTestVariants['table-generator-promotion'] === 'enabled' &&
    !popupPresent &&
    !inactiveTutorials.includes('table-generator-promotion') &&
    !hideBecauseNewUser

  useEffect(() => {
    if (showPromotion) {
      setCurrentPopup('table-generator-promotion')
    }
  }, [showPromotion, setCurrentPopup])

  if (!showPromotion) {
    return <>{children}</>
  }

  return (
    <>
      <PromotionOverlayContent ref={ref} />
      <span ref={ref}>{children}</span>
    </>
  )
}

const PromotionOverlayContent = memo(
  forwardRef<HTMLSpanElement>(function PromotionOverlayContent(
    _props,
    ref: Ref<HTMLSpanElement>
  ) {
    const { deactivateTutorial } = useEditorContext()
    const [timeoutExpired, setTimeoutExpired] = useState(false)

    const onClose = useCallback(() => {
      deactivateTutorial('table-generator-promotion')
      postJSON('/tutorial/table-generator-promotion/complete').catch(
        debugConsole.error
      )
    }, [deactivateTutorial])

    const onDismiss = useCallback(() => {
      onClose()
      sendMB('table-generator-promotion-dismissed')
    }, [onClose])

    const onComplete = useCallback(() => {
      onClose()
      sendMB('table-generator-promotion-completed')
    }, [onClose])

    useEffect(() => {
      const interval = setTimeout(() => {
        setTimeoutExpired(true)
      }, DELAY_BEFORE_SHOWING_PROMOTION)
      return () => clearTimeout(interval)
    }, [])

    const [currentPage, setCurrentPage] = useState<number>(0)

    const nextPage = useCallback(() => {
      setCurrentPage(cur => clamp(cur + 1))
      sendMB('table-generator-promotion-next-page')
    }, [])

    const page = PROMOTION_PAGES[clamp(currentPage)]
    const PageComponent = page.body
    const pageTitle = page.title
    const isAtLastPage = currentPage >= PROMOTION_PAGES.length - 1

    const hideBecauseOfGrammarly =
      grammarlyExtensionPresent() && NOW_TIME < GRAMMARLY_CUTOFF_TIME

    if (
      !timeoutExpired ||
      !ref ||
      typeof ref === 'function' ||
      !ref.current ||
      hideBecauseOfGrammarly
    ) {
      return null
    }

    return (
      <Overlay
        placement="bottom"
        show
        target={ref.current}
        shouldUpdatePosition
      >
        <Popover
          id="table-generator-and-pasting-formatted-text-promotion"
          title={
            <span>
              {pageTitle}
              <Close variant="dark" onDismiss={onDismiss} />
            </span>
          }
          className="dark-themed"
        >
          <PromotionBody>
            <PageComponent />
          </PromotionBody>
          <Footer
            isAtLastPage={isAtLastPage}
            onComplete={onComplete}
            onNext={nextPage}
          />
        </Popover>
      </Overlay>
    )
  })
)

const PromotionBody: FC = function PromotionBody({ children }) {
  useEffect(() => {
    sendMB('table-generator-promotion-prompt')
  }, [])
  return <div style={{ maxWidth: '440px' }}>{children}</div>
}

const Footer = memo<{
  isAtLastPage: boolean
  onComplete: () => void
  onNext: () => void
}>(function Footer({ isAtLastPage, onComplete, onNext }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        justifyContent: 'space-between',
        flexDirection: 'row-reverse',
        marginTop: '9px',
      }}
    >
      {!isAtLastPage ? (
        <Button bsStyle={null} className="btn-secondary" onClick={onNext}>
          Next new feature
        </Button>
      ) : (
        <Button bsStyle={null} className="btn-secondary" onClick={onComplete}>
          Close
        </Button>
      )}
    </div>
  )
})

const TablePromotionPage: FC = memo(function TablePromotionPage() {
  return (
    <>
      <p>
        You can now insert tables with just a few clicks and edit them without
        code in <b>Visual Editor</b>. And there’s more&#8230;
      </p>
      <Video src="https://videos.ctfassets.net/nrgyaltdicpt/4NlPEKtrm6ElDN51KwUmkk/5a12df93b79cbded85e26a75a3fd1232/table_440.mp4" />
    </>
  )
})

const PastingPromotionPage: FC = memo(function PastingPromotionPage() {
  return (
    <>
      <p>
        You can also paste tables (and formatted text!) straight into{' '}
        <b>Visual Editor</b> without losing the formatting.
      </p>
      <Video src="https://videos.ctfassets.net/nrgyaltdicpt/57lKn5gFNsgz7nCvOJh6a4/e9f8ae6d41a357102363f04a0b3587b9/paste_440.mp4" />
    </>
  )
})

const PROMOTION_PAGES: { title: string; body: FC }[] = [
  {
    title: 'Big news! Insert tables from the toolbar',
    body: TablePromotionPage,
  },
  {
    title: 'Paste a table straight into Visual Editor',
    body: PastingPromotionPage,
  },
]

const clamp = (num: number) =>
  Math.min(Math.max(num, 0), PROMOTION_PAGES.length - 1)

interface VideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string
}
const Video = memo<VideoProps>(function Video({ src, ...props }: VideoProps) {
  return (
    <video
      src={src}
      preload="auto"
      autoPlay
      muted
      loop
      controls={false}
      style={{
        width: '100%',
        margin: 'auto',
        display: 'block',
      }}
      {...props}
    />
  )
})
