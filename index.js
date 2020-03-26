const core = require('@actions/core')
const github = require('@actions/github')
const getStats = require('./get_stats')

async function run() {
  try {
    const ghToken = core.getInput('github_token')
    const octokit = new github.GitHub(ghToken)

    const oldStats = await getStats('old')
    const newStats = await getStats('new')

    const comparisons = Object.keys(newStats).map(path => {
      const next = oldStats[path]
      const prev = newStats[path] || { path, name: next.name, size: { normal: 0, gzipped: 0} }
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

    for (const comparison of comparisons) {
      const name = `Bundlesize: ${comparison.name} (${comparison.path})`
      // const signNormal = comparison.change.normal >= 0 ? '+' : ''
      // const signGzipped = comparison.change.gzipped >= 0 ? '+' : ''

      const [repoOwner, repoName] = process.env.GITHUB_REPOSITORY.split('/')

      await octokit.checks.create({
        owner: repoOwner,
        repo: repoName,
        name: name,
        head_sha: process.env.GITHUB_SHA,
        conclusion: 'success',
        output: {
          title: name,
          summary: `${comparison.old.normal} bytes -> ${comparison.new.normal} bytes (${comparison.old.gzppped} bytes -> ${comparison.new.gzipped} bytes gzipped)`
        }
      })
    }
  }
  catch (error) {
    core.setFailed(error.message);
  }
}

run()
