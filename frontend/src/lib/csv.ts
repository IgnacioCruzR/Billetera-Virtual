export type CsvValue = string | number
function csvField(value: CsvValue) {
  if (typeof value === 'number') return '"' + value + '"'
  const trimmedStart = value.trimStart()
  const safe = /^[=+\-@＝＋－＠]/.test(trimmedStart) ? '\t' + trimmedStart
    : /^[\t\r\n]/.test(value) ? "'" + value : value
  return '"' + safe.replaceAll('"', '""') + '"'
}

export function buildCsv(headers: string[], rows: CsvValue[][]) {
  return '\uFEFF' + [headers, ...rows].map(row => row.map(csvField).join(';')).join('\r\n')
}

export function downloadCsv(contents: string, filename: string) {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
