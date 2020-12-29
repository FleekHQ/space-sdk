# Contributing Guidelines

All contributions to the codebase are welcome.
Before submitting a pull request for a contribution, ensure that an issue is open that
tracks what is being contributed in the pull request.

## Submitting a Feature/Fix
Before contributing, determine if you are contributing a feature or a fix.
If contributing a feature, your branch should have the name format similar to `feature/<short-description-of-feature>` or
else if it is a fix, the branch name should be similar to `fix/<short-description-of-fix>`. Once ready, create a PR to the 
`master` branch. Your contribution will be merged after it has been approved.

## Releasing a new Version
There are two major branches: `master` and `releases`. 

All active development goes to the `master` branch. When a release is about to made, a branch should be created from the 
`master` branch with the name format `release/v*.*.*` (replace `*.*.*`) with the actual release version.

Open a PR with the new version release branch. This PR should have commits updating the
`CHANGELOG.md` file with changes being introduced in this version. It should also bump up the version of the package
(inside `lerna.json`). Merging this PR and pushing a tag would trigger the CI to create a new release with the version
and changelog.
