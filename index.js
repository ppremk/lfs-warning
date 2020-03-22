const core = require("@actions/core")
const github = require("@actions/github")

const octokit = new github.GitHub(process.env.GITHUB_TOKEN)
const context = github.context

const { owner, repo } = context.repo
const event_type = context.eventName

let issue_pr_number

// most @actions toolkit packages have async methods
async function run() {
  try {
    const fsl = core.getInput("filesizelimit")

    console.log(`Default configured filesizelimit is set to ${fsl} bytes...`)
    console.log(`Name of Repository is ${repo} and the owner is ${owner}`)
    console.log(`Triggered event is ${event_type}`)

    if (event_type === "pull_request") {
      issue_pr_number = context.payload.pull_request.number

      console.log(`The PR number is: ${issue_pr_number}`)

      const { data: pullRequest } = await octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: issue_pr_number
      })
      console.log("Before Getting Size Property")
      console.log(pullRequest) // returns an array of objects

      let prFilesWithBlobSize = await Promise.all(
        pullRequest.map(async function(item) {
          const { data: prFilesBlobs } = await octokit.git.getBlob({
            owner,
            repo,
            file_sha: item.sha
          })
  
          // pullRequest['size'] = prFilesBlobs.size
  
          let newPRobj = []
          newPRobj.push({
            filename: item.filename,
            filesha: item.sha,
            fileblobsize: prFilesBlobs.size
          })
  
          return newPRobj
        })
      ) 

      console.log("After Getting Size Property")
      console.log(prFilesWithBlobSize)

    } else {
      console.log(`No Pull Request detected. Skipping LFS warning check`)
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
