#!/usr/bin/env node
// Loads the monorepo root .env before running the Prisma CLI.
// Usage: node scripts/prisma-env.js <prisma args...>
const path = require('path');
const { execFileSync } = require('child_process');
const { config } = require('dotenv');

config({ path: path.resolve(__dirname, '../../../.env') });
config(); // local .env fallback

const prismaPath = path.resolve(__dirname, '../../../node_modules/.bin/prisma');
const args = process.argv.slice(2); // each arg is a separate element — no shell interpolation
execFileSync(prismaPath, args, { stdio: 'inherit', env: process.env });
