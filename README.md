# LFS-Warning action

This action works to prevent both:

- Large files that are not LFS tracked
- Files that are LFS tracked

from being checked-in in non-pointer format/not stored in LFS. The latter happens if the client does not have git-lfs installed.

## How it works

This action scans files in commits of a pull request and will mark the pull request as failed, add a `lfs-detected!` label and reply with an issue comment if any of the following is true about any of the pull request files:

- The file size is greater than the configured file size limit threshold.
- The file is tracked in LFS but is being checked-in as a regular file
  - the current implementation of this check is that the file has git attribute `filter: lfs` but does not contain the string `version https://git-lfs.github.com/spec/v1`

![pr-with-lfs-detected](https://user-images.githubusercontent.com/5770369/77542326-4cc7a400-6ea6-11ea-9d16-aa99be9b3240.png)

Note: Remember to configure the branch protection rule and select the `LFS-warning` status when you enable the `Required status check to pass` option.

![status-check](https://user-images.githubusercontent.com/5770369/77543439-fc514600-6ea7-11ea-8b33-ac9dedd98fd4.png)

## Inputs

### `filesizelimit`

Optional. set's the file size limit threshold. Accepts `b` (bytes), `mb` (megabytes) and `gb` (gigabytes) as units of measurement, if omitted interprets as bytes.

Default `10mb`.

### `token`

Optional. Takes a valid **GitHub Token** from the Repo by default.

### `exclusionPatterns`

Optional. A newline delimited list of glob patterns that match checked in files to exclude form LFS Warning.

### `labelName`

Optional. The name of the label, defaults to lfs-detected!

### `labelColor`

Optional. The color of the label, defaults to ff1493.

### `sendComment`

Optional. If set to false, disables sending comments.

Default `true`.

## Outputs

### `lfsFiles`

Returns an array of possible detected large file(s)

## Usage

Consume the action by referencing the stable release

```yaml
uses: ppremk/lfs-warning@v3.2
with:
  token: ${{ secrets.GITHUB_TOKEN }} # Optional
  filesizelimit: 10MB
  exclusionPatterns: |
    **/*.png
```

## Contributers

- [@froi](https://github.com/froi)
- [@decyjphr](https://github.com/decyjphr)
- [@naseemkullah](https://github.com/naseemkullah)
- [@TomerFi](https://github.com/TomerFi)
- [@davidlj95](https://github.com/davidlj95) 
- [@SkyTrix](https://github.com/SkyTrix)
- [@srz-zumix](https://github.com/srz-zumix)
- [@zzgab](https://github.com/zzgab)
- [@samthebest](https://github.com/samthebest)

