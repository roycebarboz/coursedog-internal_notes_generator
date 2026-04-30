---
name: create-internal-events-notes
description: This skill activates automatically when the user request matches any of these prompt types: "create a [task]", "help me with [workflow]", "generate [output type]", "improve [existing thing]", "build [feature]", "analyze [data]", "write [document/code]", or when the user explicitly says "/your-skill-name" or "@your-skill-name". It is designed for modular, reusable execution in Claude Code, Claude.ai, or API workflows.
license: MIT
metadata:
  author: Your Name / @handle
  version: 1.0.0
  compatibility: Claude Code, Claude.ai, API
---

# Your Skill Name

**Purpose**  
[One-sentence purpose of the skill]

**When to activate**  
- Any user prompt that contains: "create a [task]", "help me with [workflow]", "generate [output type]", "improve [existing thing]", "build [feature]", "analyze [data]", "write [document/code]", "plan [project]", "review [code/content]", or similar action-oriented requests.  
- Explicit activation commands: "/your-skill-name" or "@your-skill-name".  
- When the user pastes incomplete or vague instructions that match the skill’s domain (e.g., marketing, coding, research, design, etc.).  
- Natural language triggers: any sentence starting with "Can you...", "I need to...", "Make me a...", or "Optimize...".

## Instructions

1. Detect the exact user intent using the activation triggers above.  
2. Follow the step-by-step workflow defined in this skill.  
3. Apply all rules and verification steps before outputting.  
4. Maintain single-responsibility focus — do only what this skill is designed for.

## Examples

**User prompt type**: "create a [task]" or "help me with [workflow]"  
**Skill output**: [example output here]

**User prompt type**: Explicit "/your-skill-name"  
**Skill output**: [example output here]

## Guidelines (Rules Claude must follow)

- Always stay within the defined scope of this skill.  
- Never add extra features outside the purpose.  
- Preserve user intent exactly.  
- Output only in the required format specified below.

## Verification Checklist (before final output)

- [ ] Activation trigger matched  
- [ ] All instructions followed  
- [ ] Verification steps completed  
- [ ] Output format strictly followed

## Activation Triggers (for users)

- Natural language: any of the prompt types listed in **When to activate**  
- Explicit: `/your-skill-name` or `@your-skill-name`