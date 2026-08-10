import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const supportDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(supportDir, '..', '..');
const repoDir = path.resolve(siteDir, '..');
const outputDir = path.join(siteDir, 'public', 'data');

await mkdir(outputDir, { recursive: true });

const dataDir = path.join(repoDir, 'data');
const dataFiles = (await readdir(dataDir, { withFileTypes: true }))
  .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
  .map(entry => entry.name)
  .sort();

const contentFiles = ['bateau.json', 'videos.json', 'meteo.json'];
const copies = [
  ...dataFiles.map(name => [path.join(dataDir, name), path.join(outputDir, name)]),
  ...contentFiles.map(name => [path.join(repoDir, 'content', name), path.join(outputDir, name)]),
];

await Promise.all(copies.map(([source, destination]) => copyFile(source, destination)));
console.log(`Données synchronisées : ${copies.length} fichiers → ${outputDir}`);
