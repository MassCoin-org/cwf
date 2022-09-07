import * as fs from 'fs';

export function exists(path: string): boolean {
  return fs.existsSync(path);
}

export function getContents(path: string): string {
  return fs.readFileSync(path, 'utf-8');
}

export function filesInFolder(folder: string): string[] {
  return fs.readdirSync(folder);
}
