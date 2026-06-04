# wg

`wg` is a small CLI wrapper around Morph Warp Grep for fast code search in local repositories and public GitHub repositories.

## Usage

```sh
wg [options] <search-term>
wg github <owner/repo> <search-term> [options]
wg read <owner/repo> <file-path> [options]
```

Common options:

- `--api-key <key>`: Morph API key for this invocation.
- `-C, --cwd <path>`: repo root for local search.
- `--include <glob>` / `--exclude <glob>`: repeatable local-search filters.
- `--node-modules`: include dependency directories in local search.
- `--branch <branch>`: branch for GitHub search/read.
- `--start <n>` / `--end <n>`: line range for `wg read`.
- `--stream`: print tool-call steps to stderr while a search runs.
- `--json`: emit the raw result as JSON.
- `--debug`: enable SDK debug logging.

## Authentication

`wg` needs a Morph API key. The simplest setup is:

```sh
export MORPHLLM_API_KEY=sk-...
```

You can also pass a key for a single invocation:

```sh
wg --api-key sk-... "search term"
```

Authentication precedence is:

1. `--api-key <key>`
2. `MORPHLLM_API_KEY`
3. Doppler secret lookup for `MORPHLLM_API_KEY`

### Doppler-backed secrets

If you use Doppler, `wg` can read `MORPHLLM_API_KEY` from your Doppler account after `--api-key` and `MORPHLLM_API_KEY` are absent.

A Doppler token must be available to the process as `DOPPLER_TOKEN`, or supplied with `--doppler-token`:

```sh
export DOPPLER_TOKEN=dp.st....
wg "search term"
```

By default, `wg` reads from Doppler project `wg` and config `prd`. Override those defaults with environment variables:

```sh
export WG_DOPPLER_PROJECT=my-project
export WG_DOPPLER_CONFIG=dev
wg "search term"
```

Or override them for a single invocation:

```sh
wg --doppler-project my-project --doppler-config dev --doppler-token dp.st.... "search term"
```

`--api-key` always takes precedence over all environment variables and Doppler options.
