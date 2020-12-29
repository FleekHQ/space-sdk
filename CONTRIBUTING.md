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

- Open a PR with the new version release branch. This PR should have commits updating the `changelogs/v*.*.*.md` file with changes 
that is being introduced in this version.
- In this PR, You should have also bumped up the version of the packages (inside `lerna.json`) using the npm command 
`npm run bumpversion <new-version>`.
- Merging this PR and pushing a tag would trigger the CI to create and publish new release with the version and changelog.
