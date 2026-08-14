# Codex Project Instructions

## CodeGraph

- Use CodeGraph for codebase discovery before falling back to text search.
- Run `codegraph sync .` after source changes when graph results are needed.
- Use `codegraph query`, `callers`, `callees`, `impact`, and `affected` to trace symbols, dependencies, and relevant tests.
- The repository graph lives in `.codegraph/` and is local generated state; do not commit it.

## Scope

- Preserve unrelated worktree changes.
- Keep changes focused and follow the conventions of the affected module.
