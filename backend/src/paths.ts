import { fileURLToPath } from 'node:url';

// src/ e dist/ estão no mesmo nível: os caminhos valem em desenvolvimento e no build.
export const environmentPath = fileURLToPath(new URL('../../.env', import.meta.url));
export const frontendDistPath = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));
export const migrationDirectory = new URL('../migrations/', import.meta.url);
