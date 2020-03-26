const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const cp = require('child_process')

module.exports = async function getStats(subDir, skipNotFound = false) {
  console.log(`Starting stat analysis for subdir ${subDir}`)
  const workspaceDir = process.env.GITHUB_WORKSPACE
  const workingDir = path.join(workspaceDir, subDir)
  const pj = JSON.parse(fs.readFileSync(path.join(workingDir, 'package.json')))

  const config = pj.actionBundlesize
  if (!config) {
    if (skipNotFound) {
      console.log('No config found, skipping')
      return {}
    } else {
      throw new Error(`No actionBundlesize config found in package.json in ${subDir}`)
    }
  }

  console.log('Running build command...')
  cp.execSync(config.build, {
    cwd: workingDir
  })

  const statsPromises = config.files.map(async (file) => {
    const filepath = path.join(workingDir, file.path)
    const normalSize = getFileSizeInBytes(filepath)
    const gzippedSize = await getGzippedSizeInBytes(filepath)

    return {
      path: file.path,
      name: file.name,
      size: {
        normal: normalSize,
        gzipped: gzippedSize
      }
    }
  })

  const stats = await Promise.all(statsPromises)

  return stats.reduce((acc, stat) => {
    acc[stat.path] = stat
    return acc
  }, {})
}

function getFileSizeInBytes(pathToFile) {
  return fs.statSync(pathToFile).size
}

async function getGzippedSizeInBytes(pathToFile) {
  const outFile = pathToFile + '.gz'
  const gzip = zlib.createGzip()
  const inp = fs.createReadStream(pathToFile)
  const out = fs.createWriteStream(outFile, { emitClose: true })

  return new Promise((res, rej) => {
    console.log('Starting gzip analysis...')
    inp.pipe(gzip)
      .pipe(out)
      .on('error', rej)
      .on('close', () => {
        const size = getFileSizeInBytes(outFile)
        console.log('Done')
        res(size)
      })
  })
}
