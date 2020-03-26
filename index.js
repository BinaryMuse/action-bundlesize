const fs = require('fs')
const path = require('path')
const core = require('@actions/core')
const github = require('@actions/github')
const getStats = require('./get_stats')

const workspaceDir = process.env.GITHUB_WORKSPACE
const [repoOwner, repoName] = process.env.GITHUB_REPOSITORY.split('/')
const octokit = new github.GitHub(process.env.GITHUB_TOKEN)

function writeStatus(name, filepath, state, description) {
  const context = `Bundlesize: ${name} (${filepath})`
  return octokit.repos.createStatus({
    owner: repoOwner,
    repo: repoName,
    sha: process.env.GITHUB_SHA,
    context: context,
    state: state,
    description: description
  })
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
      await writeStatus(file.name, file.path, 'pending', 'Checking...')
    }

    // Use the files from the new config but the build instructions fromm the old config if it exists
    const oldStats = await getStats(Object.assign({}, config, {build: oldConfig.build || config.build}), oldDir)
    const newStats = await getStats(config, newDir)

    const comparisons = Object.keys(newStats).map(path => {
      const next = newStats[path]
      const prev = oldStats[path] || { path, name: next.name, size: { normal: 0, gzipped: 0} }
      const change = {
        normal: next.size.normal - prev.size.normal,
        gzipped: next.size.gzipped - prev.size.gzipped
      }

      return {
        path,
        name: next.name,
        old: prev.size,
        new: next.size,
        change
      }
    })

    console.log('Analysis done. Setting check statuses...')
    for (const comparison of comparisons) {
      const result = `${comparison.old.normal} bytes -> ${comparison.new.normal} bytes (${comparison.old.gzppped} bytes -> ${comparison.new.gzipped} bytes gzipped)`
      await writeStatus(comparison.name, comparison.path, 'success', result)
    }
  }
  catch (error) {
    core.setFailed(error.message);
  }
}

run()
