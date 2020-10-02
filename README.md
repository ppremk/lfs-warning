## LFS-Warning action

This action scans files in commits of a Pull Request and compares it against the configured file size limit threshold. If the threshold is exceeded for any of the file, the action will mark the pull request as failed, add a `lfs-detected!` label and reply with an issue comment containing detected large file(s).

![pr-with-lfs-detected](https://user-images.githubusercontent.com/5770369/77542326-4cc7a400-6ea6-11ea-9d16-aa99be9b3240.png)

Note: Remember to configure the branch protection rule and select the `LFS-warning` status when you enable the `Required status check to pass` option.

![status-check](https://user-images.githubusercontent.com/5770369/77543439-fc514600-6ea7-11ea-8b33-ac9dedd98fd4.png)

## Inputs

#### `filesizelimit `

Required, set's the file size limit threshold in bytes. Default "10MB".

#### `token `

Optional. Takes a valid **GitHub Token** from the Repo by default. 

## Outputs

#### `lfsFiles `

Returns an array of possible detected large file(s)

## Usage

Consume the action by referencing the stable branch

```yaml
uses: actionsdesk/lfs-warning@v2.0
with:
  token: ${{ secrets.GITHUB_TOKEN }} # Optional
  filesizelimit: '10485760' # 10 MB is 10485760 Bytes
```
