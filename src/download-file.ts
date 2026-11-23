/** True when saving uses the browser's download manager instead of a file picker. */
export function usesBrowserDownload(): boolean {
  return !window.pvlaneDesktop && typeof (window as unknown as {
    showSaveFilePicker?: unknown;
  }).showSaveFilePicker !== 'function';
}

/** Start a local download; the browser controls the destination and completion. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  try {
    document.body.appendChild(link);
    link.click();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  } finally {
    link.remove();
  }
  // Give the download manager time to consume large projects and reports.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
