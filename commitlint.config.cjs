module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['chore', 'feat', 'fix', 'docs', 'style', 'refactor', 'test', 'build', 'ci', 'revert']],
    'subject-full-stop': [0, 'never'],
    'header-max-length': [2, 'always', 100]
  }
}
