const core = require("@actions/core")
const github = require("@actions/github")

const octokit = new github.GitHub(process.env.GITHUB_TOKEN)
const context = github.context

const { owner, repo } = context.repo
const event_type = context.eventName

let issue_pr_number
// const labels = [{
//   name: "lfs-detected!",
//   color: "ff1493",
//   description: "Warning Label for use when LFS is detected in the commits of a Pull Request"
// }]

// most @actions toolkit packages have async methods
async function run() {
  try {
        const fsl = core.getInput("filesizelimit")

        console.log(
          `Default configured filesizelimit is set to ${fsl} bytes...`
        )
        console.log(`Name of Repository is ${repo} and the owner is ${owner}`)
        console.log(`Triggered event is ${event_type}`)
        
        // Get LFS Warning Label
        let lfslabelObj = {}
        try {
          lfslabelObj = await octokit.issues.getLabel({
            owner,
            repo,
            name: "lfs-detected!"
          })
        } catch (error) {
          if (error.message === "##[error]Not Found") {
            lfslabelObj = {}
          } else {
            console.log(`getLabel error: ${error.message}`)
          }
        }

        if (Object.entries(lfslabelObj).length === 0 && lfslabelObj.constuctor === Object) {
          await octokit.issues.createLabel({
            owner,
            repo,
            name: "lfs-detected!",
            color: "ff1493",
            description: "Warning Label for use when LFS is detected in the commits of a Pull Request"
          })
          console.log(`No lfs warning label detected. Creating new label ...`)
          console.log(`LFS warning label created`)
        } else {
          console.log(`Repo has label - ${lfslabelObj}`)
        }

        // Get List of files for Pull Request
        if (event_type === "pull_request") {
          issue_pr_number = context.payload.pull_request.number

          console.log(`The PR number is: ${issue_pr_number}`)

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

          console.log(prFilesWithBlobSize) // for debug - remove for production

          let lfsFile = []
          for (let prop in prFilesWithBlobSize) {
            if (prFilesWithBlobSize[prop].fileblobsize > fsl) {
              lfsFile.push(prFilesWithBlobSize[prop].filename)
            }
          }

          if (lfsFile.length > 0) {
            console.log("Detected large file(s):")
            console.log(lfsFile)

            let lfsFileNames = lfsFile.join("\n")
            let bodyTemplate = `## :warning: Possible large file(s) detected :warning: \n
            The following file(s) exceeds the file size limit: ${fsl} bytes, as set in the .yml configuration files
            
            ${lfsFileNames.toString()} \n
            Consider using git-lfs as best practises to track and commit file(s)`

            await octokit.issues.addLabels({
              owner,
              repo,
              issue_number: issue_pr_number,
              labels: [{
                name: "lfs-detected!",
                color: "ff1493",
                description: "Warning Label for use when LFS is detected in the commits of a Pull Request"
              }]
            })

            await octokit.issues.createComment({
              owner,
              repo,
              issue_number: issue_pr_number,
              body: bodyTemplate
            })

            core.setOutput("lfsFiles", lfsFile)
            core.setFailed(
              `Large File detected! Setting PR status to failed. Consider using git-lfs to track the LFS files`
            )
          } else {
            console.log("No large file(s) detected...")
          }

          // TODO:
          // git lfs attributes misconfiguration aka missing installation on client while git-lfs is configured on repo upstream
        } else {
          console.log(`No Pull Request detected. Skipping LFS warning check`)
        }
      } catch (error) {
    core.setFailed(error.message)
  }
}

run()
