---
name: karpathy-guidelines
description: Behavioral guidelines to reduce common LLM coding mistakes. Use when writing, reviewing, or refactoring code to avoid overcomplication, make surgical changes, surface assumptions, and define verifiable success criteria.
license: MIT
---

# Workflow: Superpowers

Every request in this repo goes through the Superpowers skills
(https://github.com/obra/superpowers).

- Claude Code: the plugin is enabled in `.claude/settings.json`
  (`superpowers@claude-plugins-official`). Accept the install prompt when you
  first open the repo. Other agents: install Superpowers for your harness as
  described in the upstream README.
- At the start of every conversation, load and follow the `using-superpowers`
  skill.
- Before acting on any request, check whether a skill applies. If one might,
  load it and follow it exactly.
- Think, plan, then do:
  1. Think: `brainstorming` to clarify the goal and agree on a design.
  2. Plan: `writing-plans` to turn the design into small, verifiable steps.
  3. Do: `executing-plans` or `subagent-driven-development`, with
     `test-driven-development` for code and `systematic-debugging` for bugs.
  4. Verify: `verification-before-completion` before claiming anything is done.
- When a request needs a capability no local skill covers, use
  `.claude/skills/find-skills/SKILL.md` to look for one.
- The Karpathy guidelines below still apply on top of these skills.

# Karpathy Guidelines

Behavioral guidelines to reduce common LLM coding mistakes, derived from [Andrej Karpathy's observations](https://x.com/karpathy/status/2015883857489522876) on LLM coding pitfalls.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
