#!/usr/bin/env node

// Thin wrapper to delegate to the ESM script with top-level await
const { spawnSync } = require('node:child_process')
const path = require('node:path')

const args = [path.join(__dirname, 'update-pipe-titles.mjs'), ...process.argv.slice(2)]
const result = spawnSync(process.execPath, args, { stdio: 'inherit' })
process.exit(result.status == null ? 1 : result.status)
