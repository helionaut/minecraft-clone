import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export function isExecutedDirectly(moduleUrl, argv = process.argv) {
  const entryPath = argv[1];

  if (!entryPath) {
    return false;
  }

  try {
    return fileURLToPath(moduleUrl) === resolve(entryPath);
  } catch {
    return false;
  }
}
