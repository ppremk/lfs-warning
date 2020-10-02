const core = require("@actions/core")
const github = require("@actions/github")

const myToken = core.getInput('token')
const octokit = new github.GitHub(myToken)

const context = github.context

const { owner, repo } = context.repo
const event_type = context.eventName

let issue_pr_number
const labels = ["lfs-detected!"]

// most @actions toolkit packages have async methods
async function run() {
  try {
        const fsl = core.getInput("filesizelimit")

        core.info(`Default configured filesizelimit is set to ${fsl} bytes...`)
        core.info(`Name of Repository is ${repo} and the owner is ${owner}`)
        core.info(`Triggered event is ${event_type}`)

        // Get LFS Warning Label
        let lfslabelObj = {}
        try {
          lfslabelObj = await octokit.issues.getLabel({
            owner,
            repo,
            name: "lfs-detected!"
          })
        } catch (error) {
          if (error.message === "Not Found") {
            await octokit.issues.createLabel({
              owner,
              repo,
              name: "lfs-detected!",
              color: "ff1493",
              description: "Warning Label for use when LFS is detected in the commits of a Pull Request"
            })
            core.info(`No lfs warning label detected. Creating new label ...`)
            core.info(`LFS warning label created`)
          } else {
            core.error(`getLabel error: ${error.message}`)
          }
        }

        // Get List of files for Pull Request
        if (event_type === "pull_request") {
          issue_pr_number = context.payload.pull_request.number

          core.info(`The PR number is: ${issue_pr_number}`)

          const { data: pullRequest } = await octokit.pulls.listFiles({
            owner,
            repo,
            pull_number: issue_pr_number
          })

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

          core.info(prFilesWithBlobSize)

          let lfsFile = []
          for (let prop in prFilesWithBlobSize) {
            if (prFilesWithBlobSize[prop].fileblobsize > fsl) {
              lfsFile.push(prFilesWithBlobSize[prop].filename)
            }
          }

          if (lfsFile.length > 0) {
            core.info("Detected large file(s):")
            core.info(lfsFile)

            let lfsFileNames = lfsFile.join(", ")
            let bodyTemplate = `## :warning: Possible large file(s) detected :warning: \n
            The following file(s) exceeds the file size limit: ${fsl} bytes, as set in the .yml configuration files

            ${lfsFileNames.toString()}

            Consider using git-lfs as best practises to track and commit file(s)`

            await octokit.issues.addLabels({
              owner,
              repo,
              issue_number: issue_pr_number,
              labels
            })

            await octokit.issues.createComment({
              owner,
              repo,
              issue_number: issue_pr_number,
              body: bodyTemplate
            })

            core.setOutput("lfsFiles", lfsFile)
            core.setFailed(`Large File detected! Setting PR status to failed. Consider using git-lfs to track the LFS files`)

          } else {
            core.info("No large file(s) detected...")
          }

          // TODO:
          // git lfs attributes misconfiguration aka missing installation on client while git-lfs is configured on repo upstream

        } else {
          core.info(`No Pull Request detected. Skipping LFS warning check`)
        }
      } catch (error) {
    core.setFailed(error.message)
  }
}

run()
