/**
 * Toast Image save flow, extracted from the React component so it can be
 * unit-tested in Node (fetch is injected; Node 22 provides FormData/Blob).
 */

import { outputFormatForName } from './toast-image-utils'

export interface SaveInput {
  projectId: string
  file: { name: string }
  folderId: string
  /** CSRF token (from ol-csrfToken meta). */
  csrfToken?: string
  fetchImpl: typeof fetch
  /** The TUI editor's toDataURL (already producing the right container type). */
  toDataURL: (options?: { format?: string; quality?: number }) => string
  /** i18n translate function. */
  t: (key: string, options?: Record<string, unknown>) => string
}

export type SaveResult =
  | { ok: true; uploadedId: string | null }
  | { ok: false; error: string }

/**
 * Serialize the edited image and re-upload it under the same file name
 * (replacing the file). Returns the uploaded entity id (when the server
 * responds with JSON) so the caller can refresh the file view.
 */
export async function saveEditedImage(input: SaveInput): Promise<SaveResult> {
  try {
    const format = outputFormatForName(input.file.name)
    const dataUrl = input.toDataURL({ format, quality: 0.88 })

    const dataRes = await input.fetchImpl(dataUrl)
    if (!dataRes.ok) {
      throw new Error(
        input.t('image_edit_upload_read_failed', { status: dataRes.status })
      )
    }
    const blob = await dataRes.blob()

    const formData = new FormData()
    formData.append('qqfile', blob, input.file.name)
    formData.append('name', input.file.name)

    const uploadRes = await input.fetchImpl(
      `/project/${input.projectId}/upload?folder_id=${encodeURIComponent(
        input.folderId || undefined || ''
      )}`,
      {
        method: 'POST',
        headers: { 'X-CSRF-TOKEN': input.csrfToken || '' },
        body: formData,
      }
    )
    if (!uploadRes.ok) {
      throw new Error(
        input.t('image_edit_upload_failed', { status: uploadRes.status })
      )
    }

    let uploadedId: string | null = null
    try {
      const data = await uploadRes.clone().json()
      uploadedId = data?.entity_id ?? null
    } catch (e) {
      // Non-JSON response: the upload itself succeeded; continue.
    }

    return { ok: true, uploadedId }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'image_edit_failed' }
  }
}
