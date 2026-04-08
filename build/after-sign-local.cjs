const { promisify } = require('node:util')
const { execFile } = require('node:child_process')
const path = require('node:path')

const execFileAsync = promisify(execFile)

async function run(command, args) {
  await execFileAsync(command, args, {
    env: process.env
  })
}

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') {
    return
  }

  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = path.join(context.appOutDir, appName)

  await run('codesign', ['--force', '--deep', '--sign', '-', appPath])
  await run('xattr', ['-cr', appPath])
}
