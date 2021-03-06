const fs = require('fs')
const path = require('path')
const core = require('@actions/core')
const github = require('@actions/github')
const getStats = require('./get_stats')

const API_DELAY = 1000
const workspaceDir = process.env.GITHUB_WORKSPACE
const [repoOwner, repoName] = process.env.GITHUB_REPOSITORY.split('/')
const octokit = new github.GitHub(process.env.GITHUB_TOKEN)

async function writeStatus(name, filepath, state, descriptionNormal, descriptionGzipped) {
  descriptionGzipped = descriptionGzipped || descriptionNormal
  const contextNormal = `${name} (${filepath})`
  const contextGzipped = `${name} (gzipped) (${filepath}.gz)`

  const out1 = await octokit.repos.createStatus({
    owner: repoOwner,
    repo: repoName,
    sha: process.env.GITHUB_SHA,
    context: contextNormal,
    state: state,
    description: descriptionNormal
  })
  console.log('>>>>>>>>>>')
  console.log(out1)
  console.log('<<<<<<<<<<')
  await new Promise(r => setTimeout(r, API_DELAY))
  const out2 = await octokit.repos.createStatus({
    owner: repoOwner,
    repo: repoName,
    sha: process.env.GITHUB_SHA,
    context: contextGzipped,
    state: state,
    description: descriptionGzipped
  })
  console.log('>>>>>>>>>>')
  console.log(out2)
  console.log('<<<<<<<<<<')
  await new Promise(r => setTimeout(r, API_DELAY))
}

function getConfig(workingDir) {
  const pj = JSON.parse(fs.readFileSync(path.join(workingDir, 'package.json')))
  return pj.actionBundlesize
}

async function run() {
  try {

    const oldDir = path.join(workspaceDir, 'old')
    const newDir = path.join(workspaceDir, 'new')

    const oldConfig = getConfig(oldDir) || {}
    const config = getConfig(newDir)
    if (!config) {
      throw new Error(`No config found in actionBundlesize key in package.json from ${newDir}`)
    }

    for (const file of config.files) {
      await writeStatus(file.name, file.path, 'pending', 'Calculating...')
    }

    // Use the files from the new config but the build instructions fromm the old config if it exists
    const oldStats = await getStats(Object.assign({}, config, {build: oldConfig.build || config.build}), oldDir)
    const newStats = await getStats(config, newDir)

    // const comparisons = config.files.map((file) => {
    //   // const next = newStats[path]
    //   const next = newStats.find(s => s.path === file.path)
    //   const prev = oldStats[path] || { path, name: next.name, size: { normal: 0, gzipped: 0} }

    //   return {
    //     path,
    //     name: next.name,
    //     old: prev.size,
    //     new: next.size
    //   }
    // })

    /* eslint-disable */
    // for (const comparison of comparisons) {
    for (const file of config.files) {
      const newStat = newStats.find(s => s.path === file.path)
      let oldStat = oldStats.find(s => s.path === file.path) || { size: { normal: 0, gzipped: 0 } }

      const changeNormal = `${formatChange(oldStat.size.normal, newStat.size.normal)}`
      const changeGzipped = `${formatChange(oldStat.size.gzipped, newStat.size.gzipped)}`

      await writeStatus(file.name, file.path, 'success', changeNormal, changeGzipped)
    }
    /* eslint-enable */
  } catch (error) {
    core.setFailed(error.message);
  }
}

function formatChange(oldBytes, newBytes) {
  const diffBytes = newBytes - oldBytes
  const absDiffBytes = Math.abs(diffBytes)
  const formatOld = fileSizeIEC(oldBytes)
  const formatNew = fileSizeIEC(newBytes)
  const formatDiff = fileSizeIEC(absDiffBytes)
  const sign = diffBytes >= 0 ? '+' : '-'
  const changeInPercent = absDiffBytes / oldBytes * 100
  const percentFormatted = (Math.round(changeInPercent * 100) / 100).toFixed(2)

  return `${formatOld} → ${formatNew} (${sign}${formatDiff} / ${sign}${percentFormatted}%)`
}

function fileSizeIEC(a,b,c,d,e){
  return (b=Math,c=b.log,d=1024,e=c(a)/c(d)|0,a/b.pow(d,e)).toFixed(2)
  +' '+(e?'KMGTPEZY'[--e]+'iB':'Bytes')
 }

run()
