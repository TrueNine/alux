---
name: alux-github-codeql
description: Analyze source code with GitHub CodeQL for security vulnerabilities and code quality issues. Use when creating CodeQL databases, running built-in or custom queries, reviewing SARIF results, or configuring CodeQL analysis in CI.
version: "0.2.30"
license: "GPL-3.0-only"
metadata:
  version: "0.2.30"
---

# CodeQL Analysis

Use the CodeQL CLI to build a database from a repository, analyze it with a query suite or query pack, and preserve the SARIF results for review or code-scanning upload. Prefer the repository's existing build and CI configuration over inventing a new analysis flow.

## Workflow

1. Confirm the repository, commit, languages, build command, and intended analysis scope. Do not analyze a different checkout or upload results to a remote repository without explicit authorization.
2. Check that the CodeQL CLI is installed and identify the supported language name:

   ```bash
   codeql version
   codeql resolve languages
   ```

3. Create a fresh database outside the source tree when possible. Use `--command` for compiled languages and `--build-mode=none` only when the language and analysis support an unbuilt extraction:

   ```bash
   codeql database create .codeql/db/javascript \
     --language=javascript-typescript \
     --source-root=.
   ```

   For a compiled project, capture the real build:

   ```bash
   codeql database create .codeql/db/app \
     --language=java-kotlin \
     --command='./gradlew build -x test' \
     --source-root=.
   ```

   Use `--overwrite` only when replacing the named database is intentional. Never use a stale database without confirming its source revision and extractor configuration.

4. Analyze with the smallest appropriate built-in suite first. Use a pinned query pack or a local query only when the task requires it:

   ```bash
   codeql database analyze .codeql/db/javascript \
     codeql/javascript-queries:codeql-suites/javascript-security-and-quality.qls \
     --format=sarif-latest \
     --output=codeql-results.sarif
   ```

   Common alternatives include a language-specific security suite, a local `.ql` or `.qls` file, a query directory, or a query pack. If a pack is not available locally, use the documented `--download` behavior and record the selected version rather than silently using an unpinned dependency.

5. Inspect the SARIF output and validate that it contains results for the intended commit, language, and source root. Treat a successful command with zero findings as a valid result, not proof that the repository is defect-free.
6. Report findings with the query name, source location, data flow or path explanation, severity, and a minimal remediation. Distinguish CodeQL alerts from build or extractor warnings.
7. Upload SARIF only when the destination, repository, ref, and commit are authorized and known. Keep local output for review when upload is not requested.

## Query Development

For a custom query, start with the target language's standard libraries and examples. Add tests containing both positive and negative cases before broadening the query. Run the query against a representative database, then review false positives and result messages:

```bash
codeql query run path/to/query.ql \
  --database=.codeql/db/javascript \
  --output=query-results.bqrs

codeql bqrs decode query-results.bqrs \
  --format=csv \
  --output=query-results.csv
```

Use a query suite (`.qls`) when multiple queries must be selected together. Keep custom query metadata complete, including the query kind, ID, name, severity, precision, and remediation guidance where required by the target integration.

## CI and Safety

- Reuse the CI checkout, dependency setup, and build flags that production code uses.
- Keep databases, SARIF files, and downloaded packs out of version control unless the repository explicitly tracks them; add local paths to `.gitignore` when appropriate.
- Do not suppress alerts, downgrade severity, or exclude paths merely to make a run clean. Document intentional exclusions and verify their scope.
- Avoid `--rerun` or database replacement flags until the previous database state has been inspected.
- Treat extractor warnings, missing build steps, unsupported languages, and truncated logs as incomplete analysis.
- Use GitHub Actions CodeQL workflows when the repository already standardizes on them; use the CLI directly for local debugging, custom query development, or reproducing CI behavior.

## Useful References

- [CodeQL CLI overview](https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-cli)
- [`database analyze` reference](https://docs.github.com/en/code-security/reference/code-scanning/codeql/codeql-cli-manual/database-analyze)
- [Analyze code with CodeQL queries](https://docs.github.com/en/code-security/tutorials/customize-code-scanning/analyze-code)
- [CodeQL query packs](https://docs.github.com/en/code-security/concepts/code-scanning/codeql/query-packs)
