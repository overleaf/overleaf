import { deleteJSON, getJSON, postJSON, FetchError } from '@/infrastructure/fetch-json'
import getMeta from '@/utils/meta'
import type {
  AuditEntry,
  CommunityManifest,
  JobItem,
  JobStreamEvent,
  PackageItem,
  PackageSource,
  PackagesListResponse,
  SourceHealth,
  UploadValidationResult,
} from '../types'

export function listPackages(params: {
  source?: string
  status?: string
  sort?: string
  q?: string
  page?: number
  limit?: number
}): Promise<PackagesListResponse> {
  const qs = new URLSearchParams()
  if (params.source) qs.set('source', params.source)
  if (params.status) qs.set('status', params.status)
  if (params.sort) qs.set('sort', params.sort)
  if (params.q) qs.set('q', params.q)
  if (params.page) qs.set('page', String(params.page))
  if (params.limit) qs.set('limit', String(params.limit))
  return getJSON(`/api/packages?${qs.toString()}`)
}

export function getPackageDetail(name: string): Promise<PackageItem> {
  return getJSON(`/api/packages/${encodeURIComponent(name)}`)
}

export function installPackages(
  names: string[],
  source?: PackageSource
): Promise<{ ok: boolean; jobId: string; job: JobItem }> {
  return postJSON('/api/packages/install', {
    body: { names, ...(source ? { source } : {}) },
  })
}

export function removePackages(
  names: string[],
  source?: PackageSource | 'auto'
): Promise<{ ok: boolean; jobId: string; job: JobItem }> {
  return postJSON('/api/packages/remove', {
    body: { names, ...(source ? { source } : {}) },
  })
}

export function updatePackages(body: {
  names?: string[]
  all?: boolean
}): Promise<{ ok: boolean; jobId: string; job: JobItem }> {
  return postJSON('/api/packages/update', { body })
}

export function deleteCustomPackage(name: string): Promise<{ ok: boolean }> {
  return deleteJSON(`/api/packages/custom/${encodeURIComponent(name)}`)
}

async function postMultipart<T>(url: string, formData: FormData): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'X-Csrf-Token': getMeta('ol-csrfToken'),
      Accept: 'application/json',
    },
    body: formData,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new FetchError(
      data?.error || data?.message || response.statusText,
      url,
      { method: 'POST' },
      response,
      data
    )
  }
  return data as T
}

export function validateUploadFile(formData: FormData): Promise<UploadValidationResult> {
  return postMultipart('/api/packages/upload/validate', formData)
}

export function uploadCustomPackage(
  formData: FormData
): Promise<{ ok: boolean; jobId: string; packageName: string; job: JobItem }> {
  return postMultipart('/api/packages/upload', formData)
}

export function listJobs(): Promise<{ ok: boolean; items: JobItem[] }> {
  return getJSON('/api/jobs')
}

export function getJobStatus(jobId: string): Promise<JobItem> {
  return getJSON(`/api/jobs/${encodeURIComponent(jobId)}`)
}

export function subscribeToJobStream(
  jobId: string,
  onEvent: (event: JobStreamEvent) => void,
  onError?: () => void
): () => void {
  const url = `/api/jobs/${encodeURIComponent(jobId)}/stream`
  const es = new EventSource(url, { withCredentials: true })

  es.onmessage = msg => {
    try {
      const parsed = JSON.parse(msg.data) as JobStreamEvent
      onEvent(parsed)
      if (parsed.status === 'success' || parsed.status === 'failed') {
        es.close()
      }
    } catch {}
  }

  es.onerror = () => {
    es.close()
    onError?.()
  }

  return () => es.close()
}

export function getSources(): Promise<SourceHealth[]> {
  return getJSON('/api/sources')
}

export function listCommunityManifests(): Promise<CommunityManifest[]> {
  return getJSON('/api/sources/community')
}

export function registerCommunityManifest(body: {
  manifestUrl?: string
  manifest?: Record<string, any>
}): Promise<{ ok: boolean; manifest: CommunityManifest }> {
  return postJSON('/api/sources/community', { body })
}

export function setTexliveMirror(
  url: string
): Promise<{ ok: boolean; mirrorUrl: string }> {
  return postJSON('/api/sources/texlive/mirror', { body: { url } })
}

export function reconcilePackages(): Promise<{ ok: boolean; report: any }> {
  return postJSON('/api/packages/reconcile')
}

export function snapshotEnvironment(): Promise<{
  ok: boolean
  mode: string
  image?: string
  tag?: string
  message: string
}> {
  return postJSON('/api/packages/snapshot')
}

export function getAuditLog(
  limit = 100
): Promise<{ ok: boolean; items: AuditEntry[] }> {
  return getJSON(`/api/packages/audit?limit=${limit}`)
}

export function clearActivityHistory(
  scope: 'all' | 'jobs' | 'audit' = 'all'
): Promise<{
  ok: boolean
  scope: string
  remainingJobs: JobItem[]
  remainingAuditCount: number
}> {
  return postJSON('/api/packages/history/clear', { body: { scope } })
}
