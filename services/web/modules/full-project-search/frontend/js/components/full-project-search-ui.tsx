import React, {
  FC,
  FormEventHandler,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useProjectContext } from '@/shared/context/project-context'
import {
  MatchedFile as MatchedFileType,
  searchSnapshot,
} from '../util/search-snapshot'
import { SearchQuery } from '@codemirror/search'
import { debugConsole } from '@/utils/debugging'
import useEventListener from '@/shared/hooks/use-event-listener'
import { Col, Form, Row } from 'react-bootstrap'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import Button from '@/shared/components/button/button'
import Notification from '@/shared/components/notification'
import '../../stylesheets/full-project-search.scss'
import { userStyles } from '@/shared/utils/styles'
import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import { FullProjectMatchCounts } from './full-project-match-counts'
import { FullProjectSearchModifiers } from './full-project-search-modifiers'
import { isMac } from '@/shared/utils/os'
import { PanelHeading } from '@/shared/components/panel-heading'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { createRegExp } from '@/features/source-editor/utils/regexp'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { FullProjectSearchResults } from './full-project-search-results'
import { signalWithTimeout } from '@/utils/abort-signal'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'
import RailPanelHeader from '@/features/ide-redesign/components/rail/rail-panel-header'
import { useActiveOverallTheme } from '@/shared/hooks/use-active-overall-theme'

const FullProjectSearchUI: FC = () => {
  const { t } = useTranslation()
  const { setProjectSearchIsOpen } = useLayoutContext()
  const { projectSnapshot } = useProjectContext()
  const { openDocs } = useEditorManagerContext()
  const { pathInFolder } = useFileTreePathContext()
  const newEditor = useIsNewEditorEnabled()

  const { currentDocument: currentDoc } = useEditorOpenDocContext()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [matchedFiles, setMatchedFiles] = useState<MatchedFileType[]>()

  const { userSettings } = useUserSettingsContext()
  const { fontFamily, fontSize } = useMemo(
    () => userStyles(userSettings),
    [userSettings]
  )
  const activeOverallTheme = useActiveOverallTheme()

  const abortControllerRef = useRef<AbortController | null>(null)

  // start fetching the snapshot when the project search UI opens
  useEffect(() => {
    projectSnapshot.refresh().catch(error => {
      debugConsole.error(error)
    })
  }, [projectSnapshot])

  const currentDocPath = useMemo(() => {
    return currentDoc && pathInFolder(currentDoc.doc_id)
  }, [currentDoc, pathInFolder])

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = useCallback(
    async event => {
      event.preventDefault()

      setMatchedFiles(undefined)

      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()

      const data = new FormData(event.target as HTMLFormElement)

      const searchQuery = new SearchQuery({
        search: data.get('search') as string,
        // replace: data.get('replace') as string,
        caseSensitive: data.get('caseSensitive') === 'on',
        regexp: data.get('regexp') === 'on',
        wholeWord: data.get('wholeWord') === 'on',
        literal: data.get('regexp') !== 'on',
      })

      if (searchQuery.regexp) {
        try {
          createRegExp(searchQuery)
        } catch (error) {
          setError(t('invalid_regular_expression'))
          return
        }
      }

      setLoading(true)
      setError(undefined)
      try {
        await openDocs.awaitBufferedOps(
          signalWithTimeout(abortControllerRef.current.signal, 5000)
        )

        await projectSnapshot.refresh()
        if (!abortControllerRef.current.signal.aborted) {
          const results = await searchSnapshot(
            projectSnapshot,
            searchQuery,
            newEditor
          )
          setMatchedFiles(results)
        }
      } catch (error) {
        debugConsole.error(error)
        setError(t('generic_something_went_wrong'))
      } finally {
        setLoading(false)
      }
    },
    [openDocs, projectSnapshot, t, newEditor]
  )

  const searchInputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown: React.KeyboardEventHandler<HTMLElement> = useCallback(
    event => {
      if (event.key === 'Escape') {
        setProjectSearchIsOpen(false)
      }
    },
    [setProjectSearchIsOpen]
  )

  useEventListener(
    'keydown',
    useCallback((event: KeyboardEvent) => {
      if (
        (isMac ? event.metaKey : event.ctrlKey) &&
        event.shiftKey &&
        event.code === 'KeyF'
      ) {
        searchInputRef.current?.focus()
      }
    }, [])
  )

  const modifiersRef = useRef<{ setQuery(query: SearchQuery): void }>(null)

  useEventListener(
    'editor:full-project-search',
    useCallback((event: CustomEvent<SearchQuery>) => {
      if (modifiersRef.current != null) {
        modifiersRef.current.setQuery(event.detail)
      }
      if (searchInputRef.current != null) {
        searchInputRef.current.value = event.detail.search
        searchInputRef.current.form?.dispatchEvent(
          new Event('submit', { cancelable: true, bubbles: true })
        )
      }
    }, [])
  )

  // clear the results when the form is cleared
  const handleInput: FormEventHandler<HTMLInputElement> = useCallback(event => {
    if (
      event instanceof InputEvent &&
      event.inputType === undefined &&
      (event.target as HTMLInputElement).value.length === 0
    ) {
      setMatchedFiles(undefined)
    }
  }, [])

  const variableStyle = {
    '--font-family': fontFamily,
    '--font-size': fontSize,
  } as React.CSSProperties

  return (
    <div
      className="full-project-search"
      style={variableStyle}
      data-bs-theme={activeOverallTheme === 'light' ? 'light' : 'dark'}
    >
      {newEditor ? (
        <RailPanelHeader title={t('search')} />
      ) : (
        <PanelHeading
          title={t('search')}
          handleClose={() => setProjectSearchIsOpen(false)}
          splitTestName="full-project-search"
        />
      )}

      <div // eslint-disable-line jsx-a11y/no-static-element-interactions
        className="full-project-search-form"
        onKeyDown={handleKeyDown}
      >
        <Form
          onSubmit={handleSubmit}
          role="search"
          id="full-project-search"
          aria-label={t('search_all_project_files')}
        >
          <Row className="g-1">
            <Col>
              <OLFormControl
                type="search"
                name="search"
                size="sm"
                aria-label={t('search')}
                autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                spellCheck={false}
                autoComplete="off"
                ref={searchInputRef}
                onInput={handleInput}
                placeholder={`${t('search_all_project_files')}…`}
              />
            </Col>
            <Col className="col-auto">
              <Button type="submit" className="btn btn-primary" size="sm">
                {t('search')}
              </Button>
            </Col>
          </Row>

          <FullProjectSearchModifiers ref={modifiersRef} />
        </Form>
      </div>

      {error && <Notification type="error" content={error} />}

      <div className="match-counts">
        <FullProjectMatchCounts loading={loading} matchedFiles={matchedFiles} />
      </div>

      {matchedFiles && (
        <FullProjectSearchResults
          matchedFiles={matchedFiles}
          currentDocPath={currentDocPath}
        />
      )}
    </div>
  )
}

export default memo(FullProjectSearchUI)
