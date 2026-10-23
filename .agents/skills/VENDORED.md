# Vendored skills

`.agents/skills/` is the agent-neutral skills folder. Codex and other agents
that follow the Agent Skills convention load it automatically; any other agent
can open the `SKILL.md` files directly.

These skills are copied verbatim from upstream. Do not edit them here; re-copy
from upstream to update.

| Skills | Source | Commit | License |
| --- | --- | --- | --- |
| All except `find-skills` | https://github.com/obra/superpowers (`skills/`) | `2ce8aa15d05bd57213e6f746f953aafb7ded7a8b` | MIT, see `LICENSE-superpowers` |
| `find-skills` | https://github.com/vercel-labs/skills (`skills/find-skills`) | `a80e4c9d12d607631249d4d7d059f835d4b2f13a` | MIT, see `LICENSE-vercel-skills` |

Claude Code does not read this folder. It gets Superpowers from the plugin
enabled in `.claude/settings.json`, and `find-skills` through the symlink in
`.claude/skills/`, so nothing is listed twice.
