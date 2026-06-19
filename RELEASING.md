# Releasing parajudica to PyPI

The package is published with [PyPI Trusted Publishing](https://docs.pypi.org/trusted-publishers/),
so no API token or secret is stored in the repository. Publishing happens
automatically from `.github/workflows/publish.yml` when a GitHub Release is
published.

## One-time setup

1. Create the project on PyPI (or let the first trusted-publishing run create
   it). The name `parajudica` is reserved on first upload.
2. On PyPI, go to the project (or "Publishing" under your account for a pending
   publisher) and add a GitHub Actions trusted publisher with:
   - Owner: `alfredr`
   - Repository: `parajudica`
   - Workflow filename: `publish.yml`
   - Environment: `pypi`
3. Optionally do the same on https://test.pypi.org to dry-run uploads.

## Versioning model

One version covers the software artifact across all of its channels: the git
tag, the GitHub Release, the PyPI upload, and the Zenodo archive. The single
source of truth is `version` in `pyproject.toml`; `parajudica.__version__`
reads it via `importlib.metadata`, and `publish.yml` fails the release if the
git tag and `pyproject` version disagree.

The ontologies under `src/parajudica/metamodel/*/` are versioned
*independently* in their own `framework.toml` (validated against the `.ttl`
`owl:versionInfo` by `publish-vocab.py`). They are not bumped by a software
release; the package simply bundles whatever version is current at build time.

## Cutting a release

1. Make sure the working tree is clean and `CHANGELOG.md` has an
   `## Unreleased` section describing the changes.
2. Run `mise run release X.Y.Z` (or `scripts/release.sh X.Y.Z`). This bumps
   `pyproject.toml`, rolls `Unreleased` into the new version, commits, and tags
   `vX.Y.Z`. It does not push.
3. `git push && git push origin vX.Y.Z`
4. Create the GitHub Release for the tag (`gh release create vX.Y.Z
   --generate-notes`). Publishing it triggers `publish.yml` (build,
   `twine check`, PyPI upload) and the Zenodo webhook (archive + DOI).

## Manual / local publish (fallback)

```bash
uv build
uvx twine check dist/*

# To TestPyPI first:
uv publish --publish-url https://test.pypi.org/legacy/ --token <testpypi-token>

# To real PyPI:
uv publish --token <pypi-token>
```

## Verifying a build locally

```bash
uv build
uvx twine check dist/*

# Install the built wheel into a throwaway env and smoke-test it:
python -m venv /tmp/pj && /tmp/pj/bin/pip install dist/parajudica-*.whl
/tmp/pj/bin/parajudica --help
/tmp/pj/bin/python -c "from parajudica.engine import InferenceSystem; InferenceSystem()"
```
