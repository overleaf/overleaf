export function downloadFileContent(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  clickDownloadLink(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function downloadFileFromUrl(url: string, filename: string) {
  clickDownloadLink(url, filename)
}

function clickDownloadLink(url: string, filename: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
