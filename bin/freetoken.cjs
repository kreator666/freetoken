#!/usr/bin/env node
const { spawn } = require('child_process')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const script = path.join(projectRoot, 'ads-platform/cli/index.ts')

const child = spawn('npx', ['tsx', script, ...process.argv.slice(2)], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
