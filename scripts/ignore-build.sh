#!/usr/bin/env bash
# Whether Vercel or Netlify should build this push. Exit 0 skips the build and
# 1 builds it; Netlify documents nothing else, and Vercel fails the deployment
# on any other code, git's 128 included.

# Each host names the two commits in variables of its own. They are printed,
# set or not, so a build log shows which ones each kind of deploy provides.
print() {
  local name
  for name; do
    if [[ -v $name ]]; then echo "$name=${!name}"; else echo "$name unset"; fi
  done
}

# Under `glob` a `*` stops at `/`, so the last one is the root docs alone.
excludes=(':^worker' ':^wrangler.jsonc' ':^.github' ':^.vscode' ':^.gitignore'
  ':(exclude,glob)*.md')

if [[ ${VERCEL-} == 1 ]]; then
  print VERCEL_ENV VERCEL_GIT_COMMIT_REF VERCEL_GIT_COMMIT_SHA \
    VERCEL_GIT_PREVIOUS_SHA
  from=${VERCEL_GIT_PREVIOUS_SHA-} to=${VERCEL_GIT_COMMIT_SHA-}
  excludes+=(':^netlify.toml' ':^netlify')
elif [[ ${NETLIFY-} == true ]]; then
  print CONTEXT BRANCH HEAD COMMIT_REF CACHED_COMMIT_REF
  from=${CACHED_COMMIT_REF-} to=${COMMIT_REF-}
  excludes+=(':^vercel.json' ':^vercel')
else
  echo 'Build: neither VERCEL nor NETLIFY is set.'
  exit 1
fi
echo "git rev-parse HEAD: $(git rev-parse HEAD)"

if [[ -z $from || -z $to || $from == "$to" ]]; then
  echo 'Build: no earlier commit to compare with, or the same one again.'
elif ! git cat-file -e "$from^{commit}" 2>/dev/null; then
  echo "Build: $from is not in the clone."
elif ! git cat-file -e "$to^{commit}" 2>/dev/null; then
  echo "Build: $to is not in the clone."
elif git diff --quiet "$from" "$to" -- . "${excludes[@]}"; then
  echo "Skip: nothing outside the ignored paths changed since $from."
  exit 0
else
  echo "Build: files outside the ignored paths changed since $from."
fi
exit 1
