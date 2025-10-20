#!/usr/bin/env node

const { spawnSync } = require('node:child_process')
const path = require('node:path')

// Delegate to ESM script that uses top-level await
const mjsPath = path.join(__dirname, 'find-pipe-titles.mjs')
const result = spawnSync(process.execPath, [mjsPath, ...process.argv.slice(2)], { stdio: 'inherit' })
process.exit(result.status ?? 0)
