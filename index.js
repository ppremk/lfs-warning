const core = require("@actions/core")
const github = require("@actions/github")

// most @actions toolkit packages have async methods
async function run() {
  try {
    // This should be a token with access to your repository scoped in as a secret.
    // The YML workflow will need to set myToken with the GitHub Secret Token
    // myToken: ${{ secrets.GITHUB_TOKEN }}
    // https://help.github.com/en/actions/automating-your-workflow-with-github-actions/authenticating-with-the-github_token#about-the-github_token-secret
    // const myToken = core.getInput("GITHUB_TOKEN")

    const octokit = new github.GitHub(process.env.GITHUB_TOKEN)
    const context = github.context

    // Get owner, repo, and event from context of payload that triggered the action
    const { owner, repo } = context.repo

    const event_type = context.eventName
    let issue_pr_number

    const fsl = core.getInput("filesizelimit")
    console.log(`Default configured filesizelimit is set to ${fsl} bytes...`)

    core.setOutput("action start time", new Date().toTimeString())

    // Start Logic here

    // Get PR number
    if (event_type === "pull_request") {
      issue_pr_number = context.payload.pull_request.number
      core.setOutput("Is pull request detected?", "Yes")
    } else {
      core.setOutput("Is pull request detected?", "No")
    }

    //Get List of Files in PR
    let pr_files
    pr_files = octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: issue_pr_number
    })
    core.setOutput("pr_files:", pr_files)

    let pr_files_details
    pr_files.array.forEach(element => {
      pr_files_details = {
        file_name: element.filename,
        file_git_sha: element.sha
      }
    })
    core.setOutput("pr_files:", pr_files_details)


    // Check Blob of file
    let pr_files_blob_size
    pr_files_details.array.forEach( element => {
      pr_files_blob_size = octokit.git.getBlob({
        owner,
        repo,
        file_sha : element.file_git_sha
      });
    })
    core.setOutput("pr_files:", pr_files_blob_size)


    // Compare size of Blob with filesizelimit threshold

    // TODO

    // Create a Issue Comment if size is overlimit
    octokit.github.issues.createComment({
      owner,
      repo,
      issue_number: issue_pr_number,
      body:
        "Max file sizelimit detected, consider using Git-LFS before merging this file in your target branch"
    })

    core.setOutput("action end time", new Date().toTimeString())
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
