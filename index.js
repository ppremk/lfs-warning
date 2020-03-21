const core = require("@actions/core")
const github = require("@actions/github")

const octokit = new github.GitHub(process.env.GITHUB_TOKEN)
const context = github.context

const { owner, repo } = context.repo
const event_type = context.eventName

let issue_pr_number
let prFileNamewithBlob = []

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

      // console.log(pullRequest) // returns an array of objects

      pullRequest.forEach(async function(item) {
        const { data: prFilesBlobs } = await octokit.git.getBlob({
          owner,
          repo,
          file_sha: item.sha
        })
        // console.log(prFilesBlobs) // returns an object

        prFileNamewithBlob.push({
          filename: item.filename,
          filesha: item.sha,
          fileblobsize: prFilesBlobs.size
        })
      })

      console.log(prFileNamewithBlob)

    } else {
      console.log(`No Pull Request detected. Skipping LFS warning check`)
    }

    // Compare size of Blob with filesizelimit threshold

    // TODO

    // // Create a Issue Comment if size is overlimit
    // octokit.github.issues.createComment({
    //   owner,
    //   repo,
    //   issue_number: issue_pr_number,
    //   body:
    //     "Max file sizelimit detected, consider using Git-LFS before merging this file in your target branch"
    // })
  } catch (error) {
    core.setFailed(error.message)
  }

  // function getFilesDetails(){
  //   let pr_files_details
  //   pr_files.array.forEach(element => {
  //     pr_files_details = {
  //       file_name: element.filename,
  //       file_git_sha: element.sha
  //     }
  //   })
  //    console.log(pr_files_details)
  // }

  // function getFileBlob(){
  //     // Check Blob of file
  //     let pr_files_blob_size
  //     pr_files_details.array.forEach( element => {
  //       pr_files_blob_size = octokit.git.getBlob({
  //         owner,
  //         repo,
  //         file_sha : element.file_git_sha
  //       });
  //     })
  //     console.log(pr_files_blob_size)
  // }
}

run()
