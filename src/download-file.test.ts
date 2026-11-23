import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { downloadWorkspace, type WorkspaceFile } from './workspace-file';
import { downloadScheme } from './scheme-report';
import { usesBrowserDownload } from './download-file';

const project = { name: '屋面/A:B', version: 3, roofs: [] } as unknown as WorkspaceFile;
let link: { href: string; download: string; hidden: boolean; click: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', {});
  link = { href: '', download: '', hidden: false, click: vi.fn(), remove: vi.fn() };
  vi.stubGlobal('document', {
    createElement: vi.fn(() => link),
    body: { appendChild: vi.fn() },
  });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://nas/download');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('HTTP project download preserves the complete JSON and uses a valid filename', async () => {
  expect(usesBrowserDownload()).toBe(true);
  expect(await downloadWorkspace(project)).toBe('屋面_A_B.json');
  const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
  expect(blob.type).toBe('application/json');
  expect(JSON.parse(await blob.text())).toEqual(project);
  expect(link.download).toBe('屋面_A_B.json');
  expect(link.href).toBe('blob:http://nas/download');
  expect(document.body.appendChild).toHaveBeenCalledWith(link);
  expect(link.click).toHaveBeenCalledOnce();
  expect(link.remove).toHaveBeenCalledOnce();
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  vi.advanceTimersByTime(60_000);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith(link.href);
});

it('HTTP report download preserves Chinese text and the full HTML', async () => {
  const html = '<!doctype html><html><meta charset="utf-8"><p>方案报告</p></html>';
  expect(await downloadScheme(html, '屋面/A:B')).toBe(true);
  const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
  expect(blob.type).toBe('text/html;charset=utf-8');
  expect(await blob.text()).toBe(html);
  expect(link.download).toBe('屋面_A_B-方案报告.html');
  expect(link.click).toHaveBeenCalledOnce();
});

it('blank names still produce usable project and report filenames', async () => {
  expect(await downloadWorkspace({ ...project, name: '' })).toBe('光伏方案.json');
  await downloadScheme('报告', '');
  expect(link.download).toBe('光伏方案-方案报告.html');
});

it('a failed download trigger surfaces the failure and releases its resources', async () => {
  link.click.mockImplementation(() => { throw new Error('下载被阻止'); });
  await expect(downloadWorkspace(project)).rejects.toThrow('下载被阻止');
  expect(link.remove).toHaveBeenCalledOnce();
  expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it('a supported report file picker writes the file without triggering a download', async () => {
  const write = vi.fn().mockResolvedValue(undefined);
  const close = vi.fn().mockResolvedValue(undefined);
  const picker = vi.fn().mockResolvedValue({ createWritable: async () => ({ write, close }) });
  vi.stubGlobal('window', { showSaveFilePicker: picker });
  expect(usesBrowserDownload()).toBe(false);
  expect(await downloadScheme('<p>报告</p>', '方案')).toBe(true);
  expect(await write.mock.calls[0][0].text()).toBe('<p>报告</p>');
  expect(close).toHaveBeenCalledOnce();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

it('cancelling a file picker never falls back to an unwanted download', async () => {
  vi.stubGlobal('window', { showSaveFilePicker: async () => { throw new DOMException('取消', 'AbortError'); } });
  expect(await downloadWorkspace(project)).toBeNull();
  expect(await downloadScheme('报告', '方案')).toBe(false);
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

it('native report write errors are preserved without starting a download', async () => {
  vi.stubGlobal('window', { showSaveFilePicker: async () => ({ createWritable: async () => {
    throw new Error('磁盘写入失败');
  } }) });
  await expect(downloadScheme('报告', '方案')).rejects.toThrow('磁盘写入失败');
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
