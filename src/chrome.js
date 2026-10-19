import { existsSync } from 'node:fs';
import { join } from 'node:path';

const CANDIDATES = {
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/microsoft-edge',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  win32: [
    join(process.env.PROGRAMFILES ?? 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
    join(process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
    join(process.env.LOCALAPPDATA ?? '', 'Google\\Chrome\\Application\\chrome.exe'),
    join(process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)', 'Microsoft\\Edge\\Application\\msedge.exe'),
  ],
};

/** Resolve a Chrome/Chromium executable: explicit path > CHROME_PATH > known locations. */
export function findChrome(explicit) {
  const path = explicit ?? process.env.CHROME_PATH;
  if (path) {
    if (!existsSync(path)) throw new Error(`Chrome not found at ${path}`);
    return path;
  }
  const found = (CANDIDATES[process.platform] ?? []).find((p) => existsSync(p));
  if (!found) {
    throw new Error('No Chrome/Chromium found. Install one or pass --chrome <path> / set CHROME_PATH.');
  }
  return found;
}
