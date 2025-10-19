#!/usr/bin/env node

/**
 * Debug script to test database update operations
 */

const { spawnSync } = require('node:child_process')
const path = require('node:path')

// Delegate to ESM version with top-level await
const mjsPath = path.join(__dirname, 'debug-update.mjs')
const result = spawnSync(process.execPath, [mjsPath], { stdio: 'inherit' })
process.exit(result.status ?? 0)
