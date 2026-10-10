import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const configData = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
export const linesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'lines.json'), 'utf8'));
export const stopsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'stops.json'), 'utf8'));
export const connectionsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'connections.json'), 'utf8'));
export const transfersData = JSON.parse(fs.readFileSync(path.join(__dirname, 'transfers.json'), 'utf8'));
export const locationsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'locations.json'), 'utf8'));
