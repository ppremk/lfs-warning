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
      console.log(pullRequest) 

      let newPRobj
      let prFilesWithBlobSize = await Promise.all(
        pullRequest.map(async function(item) {
          const { data: prFilesBlobs } = await octokit.git.getBlob({
            owner,
            repo,
            file_sha: item.sha
          })

          newPRobj = {
            filename: item.filename,
            filesha: item.sha,
            fileblobsize: prFilesBlobs.size
          }

          return newPRobj
        })
      )

      console.log("After Getting Size Property")
      console.log(prFilesWithBlobSize)

      let lfsFile = []
      for(let prop in prFilesWithBlobSize){
        if (prFilesWithBlobSize[prop].fileblobsize > fsl){
          lfsFile.push(prFilesWithBlobSize[prop].filename)
        }
      }

      console.log("Detected large file(s):")
      console.log(lfsFile)

      if (lfsFile.length > 0) {
        octokit.github.issues.createComment({
          owner,
          repo,
          issue_number: issue_pr_number,
          body: `Possible large files detected. The following ${lfsFile.toString()} file(s) exceeds the file size limit: ${fsl} bytes, as set in the .yml configuration files.`
        })
      }

    } else {
      console.log(`No Pull Request detected. Skipping LFS warning check`)
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
