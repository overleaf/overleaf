import { useCallback, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  postJSON,
  deleteJSON,
  getJSON,
} from '../../../../../frontend/js/infrastructure/fetch-json'
import LeftMenuButton from '../../../../../frontend/js/features/editor-left-menu/components/left-menu-button'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLNotification from '@/shared/components/ol/ol-notification'
import { useProjectContext } from '@/shared/context/project-context'
import getMeta from '@/utils/meta'

type GitHubStatus = {
  connected: boolean
  username?: string
}

type ProjectSyncStatus = {
  configured: boolean
  repoOwner?: string
  repoName?: string
  branch?: string
  lastSyncedAt?: string
}

type Repo = {
  owner: string
  name: string
  fullName: string
  private: boolean
  defaultBranch: string
}

type Branch = {
  name: string
  protected: boolean
}

export default function GitHubSyncButton() {
  const { t } = useTranslation()
  const { _id: projectId } = useProjectContext()
  const [showModal, setShowModal] = useState(false)
  const [userStatus, setUserStatus] = useState<GitHubStatus>({ connected: false })
  const [projectStatus, setProjectStatus] = useState<ProjectSyncStatus>({
    configured: false,
  })
  const [repos, setRepos] = useState<Repo[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedRepo, setSelectedRepo] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [loading, setLoading] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [configuring, setConfiguring] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const anonymous = getMeta('ol-anonymous')

  const fetchData = useCallback(async () => {
    if (anonymous) return

    setLoading(true)
    setError('')

    try {
      const [userStatusData, projectStatusData] = await Promise.all([
        getJSON<GitHubStatus>('/user/github-sync/status'),
        getJSON<ProjectSyncStatus>(`/project/${projectId}/github-sync/status`),
      ])

      setUserStatus(userStatusData)
      setProjectStatus(projectStatusData)

      if (userStatusData.connected) {
        const reposData = await getJSON<{ repos: Repo[] }>(
          '/user/github-sync/repos'
        )
        setRepos(reposData.repos)

        if (projectStatusData.configured) {
          setSelectedRepo(
            `${projectStatusData.repoOwner}/${projectStatusData.repoName}`
          )
          setSelectedBranch(projectStatusData.branch || '')

          // Load branches for configured repo
          const branchesData = await getJSON<{ branches: Branch[] }>(
            `/user/github-sync/repos/${projectStatusData.repoOwner}/${projectStatusData.repoName}/branches`
          )
          setBranches(branchesData.branches)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch GitHub data')
    } finally {
      setLoading(false)
    }
  }, [projectId, anonymous])

  useEffect(() => {
    if (showModal) {
      fetchData()
    }
  }, [showModal, fetchData])

  const handleRepoChange = useCallback(
    async (repoFullName: string) => {
      setSelectedRepo(repoFullName)
      setSelectedBranch('')
      setBranches([])
      setError('')

      if (!repoFullName) return

      const [owner, repo] = repoFullName.split('/')

      try {
        const branchesData = await getJSON<{ branches: Branch[] }>(
          `/user/github-sync/repos/${owner}/${repo}/branches`
        )
        setBranches(branchesData.branches)

        // Auto-select main or master branch if available
        const mainBranch = branchesData.branches.find(
          b => b.name === 'main' || b.name === 'master'
        )
        if (mainBranch) {
          setSelectedBranch(mainBranch.name)
        } else if (branchesData.branches.length > 0) {
          setSelectedBranch(branchesData.branches[0].name)
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch branches')
      }
    },
    []
  )

  const handleConfigure = useCallback(async () => {
    if (!selectedRepo || !selectedBranch) {
      setError('Please select a repository and branch')
      return
    }

    setConfiguring(true)
    setError('')

    const [owner, repo] = selectedRepo.split('/')

    try {
      await postJSON(`/project/${projectId}/github-sync/configure`, {
        body: { owner, repo, branch: selectedBranch },
      })
      setProjectStatus({
        configured: true,
        repoOwner: owner,
        repoName: repo,
        branch: selectedBranch,
      })
      setSuccess('GitHub sync configured successfully')
    } catch (err: any) {
      setError(err.message || 'Failed to configure GitHub sync')
    } finally {
      setConfiguring(false)
    }
  }, [projectId, selectedRepo, selectedBranch])

  const handleUnconfigure = useCallback(async () => {
    setConfiguring(true)
    setError('')

    try {
      await deleteJSON(`/project/${projectId}/github-sync/configure`)
      setProjectStatus({ configured: false })
      setSelectedRepo('')
      setSelectedBranch('')
      setBranches([])
      setSuccess('GitHub sync removed')
    } catch (err: any) {
      setError(err.message || 'Failed to remove GitHub sync')
    } finally {
      setConfiguring(false)
    }
  }, [projectId])

  const handlePush = useCallback(async () => {
    setPushing(true)
    setError('')
    setSuccess('')

    try {
      await postJSON(`/project/${projectId}/github-sync/push`)
      setSuccess('Successfully pushed to GitHub!')
      // Refresh status to get updated lastSyncedAt
      const statusData = await getJSON<ProjectSyncStatus>(
        `/project/${projectId}/github-sync/status`
      )
      setProjectStatus(statusData)
    } catch (err: any) {
      setError(err.message || 'Failed to push to GitHub')
    } finally {
      setPushing(false)
    }
  }, [projectId])

  if (anonymous) {
    return null
  }

  return (
    <>
      <LeftMenuButton onClick={() => setShowModal(true)} icon="cloud_upload">
        {t('github_sync', { defaultValue: 'GitHub' })}
      </LeftMenuButton>

      <OLModal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <OLModalHeader>
          <OLModalTitle>
            {t('github_sync_title', { defaultValue: 'GitHub Sync' })}
          </OLModalTitle>
        </OLModalHeader>
        <OLModalBody>
          {loading ? (
            <p>{t('loading')}...</p>
          ) : !userStatus.connected ? (
            <div>
              <p>
                {t('github_not_connected', {
                  defaultValue:
                    'Your GitHub account is not connected. Please connect it in your account settings.',
                })}
              </p>
              <OLButton variant="primary" href="/user/settings#project-sync">
                {t('go_to_settings', { defaultValue: 'Go to Settings' })}
              </OLButton>
            </div>
          ) : (
            <div>
              <p className="small">
                {t('connected_as')}:{' '}
                <strong>{userStatus.username}</strong>
              </p>

              {!projectStatus.configured ? (
                <>
                  <h5>
                    {t('configure_repository', {
                      defaultValue: 'Configure Repository',
                    })}
                  </h5>
                  <OLFormGroup>
                    <OLFormLabel htmlFor="repo-select">
                      {t('repository')}
                    </OLFormLabel>
                    <OLFormControl
                      id="repo-select"
                      as="select"
                      value={selectedRepo}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        handleRepoChange(e.target.value)
                      }
                    >
                      <option value="">
                        {t('select_repository', {
                          defaultValue: '-- Select a repository --',
                        })}
                      </option>
                      {repos.map(repo => (
                        <option key={repo.fullName} value={repo.fullName}>
                          {repo.fullName} {repo.private ? '(private)' : ''}
                        </option>
                      ))}
                    </OLFormControl>
                  </OLFormGroup>

                  {branches.length > 0 && (
                    <OLFormGroup>
                      <OLFormLabel htmlFor="branch-select">
                        {t('branch')}
                      </OLFormLabel>
                      <OLFormControl
                        id="branch-select"
                        as="select"
                        value={selectedBranch}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                          setSelectedBranch(e.target.value)
                        }
                      >
                        <option value="">
                          {t('select_branch', {
                            defaultValue: '-- Select a branch --',
                          })}
                        </option>
                        {branches.map(branch => (
                          <option key={branch.name} value={branch.name}>
                            {branch.name}{' '}
                            {branch.protected ? '(protected)' : ''}
                          </option>
                        ))}
                      </OLFormControl>
                    </OLFormGroup>
                  )}
                </>
              ) : (
                <div>
                  <h5>
                    {t('linked_repository', {
                      defaultValue: 'Linked Repository',
                    })}
                  </h5>
                  <p>
                    <strong>
                      {projectStatus.repoOwner}/{projectStatus.repoName}
                    </strong>{' '}
                    ({projectStatus.branch})
                  </p>
                  {projectStatus.lastSyncedAt && (
                    <p className="small">
                      {t('last_synced', { defaultValue: 'Last synced' })}:{' '}
                      {new Date(projectStatus.lastSyncedAt).toLocaleString()}
                    </p>
                  )}
                  <OLNotification
                    type="warning"
                    content={t('github_sync_warning', {
                      defaultValue:
                        'Warning: Pushing will overwrite the GitHub repository contents with this project.',
                    })}
                  />
                </div>
              )}

              {error && <OLNotification type="error" content={error} />}
              {success && <OLNotification type="success" content={success} />}
            </div>
          )}
        </OLModalBody>
        <OLModalFooter>
          <OLButton variant="secondary" onClick={() => setShowModal(false)}>
            {t('close')}
          </OLButton>
          {userStatus.connected && (
            <>
              {projectStatus.configured ? (
                <>
                  <OLButton
                    variant="danger-ghost"
                    onClick={handleUnconfigure}
                    disabled={configuring}
                  >
                    {t('unlink_repository', { defaultValue: 'Unlink' })}
                  </OLButton>
                  <OLButton
                    variant="primary"
                    onClick={handlePush}
                    disabled={pushing}
                  >
                    {pushing
                      ? t('pushing', { defaultValue: 'Pushing...' })
                      : t('push_to_github', { defaultValue: 'Push to GitHub' })}
                  </OLButton>
                </>
              ) : (
                <OLButton
                  variant="primary"
                  onClick={handleConfigure}
                  disabled={configuring || !selectedRepo || !selectedBranch}
                >
                  {configuring
                    ? t('configuring', { defaultValue: 'Configuring...' })
                    : t('link_repository', { defaultValue: 'Link Repository' })}
                </OLButton>
              )}
            </>
          )}
        </OLModalFooter>
      </OLModal>
    </>
  )
}
