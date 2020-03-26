const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const cp = require('child_process')

module.exports = async function getStats(config, workingDir) {
  console.log(`Starting stat analysis for ${workingDir}`)
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
  return stats

  // return stats.reduce((acc, stat) => {
  //   acc[stat.path] = stat
  //   return acc
  // }, {})
}

function getFileSizeInBytes(pathToFile) {
  if (fs.existsSync(pathToFile)) {
    return fs.statSync(pathToFile).size
  } else {
    return 0
  }
}

async function getGzippedSizeInBytes(pathToFile) {
  if (!fs.existsSync(pathToFile)) {
    return 0
  }

  const outFile = pathToFile + '.gz.bundlesize-temp'
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
