---
inclusion: auto
description: MCP troubleshooting and common Kiro issues — first aid guide
---

# First Aid — Troubleshooting Guide

## MCP Server Issues

### Server won't start (ENOENT error)
- **Cause**: The binary isn't installed yet
- **Fix**: Install it first (`toolbox install <server-name>`), then enable in `.kiro/settings/mcp.json`

### Server starts but tools don't work
- **Cause**: Usually an auth issue (Midway cookie expired)
- **Fix**: Refresh your Midway cookie at https://midway-auth.amazon.com, then reconnect MCP servers

### Midway auth sunset (May 30, 2026)
- Cookie-based auth is being deprecated
- If you have mcscli, servers will use it automatically
- Check with your team for mcscli setup instructions

### How to reconnect MCP servers
- Open Command Palette (Ctrl+Shift+P) → search "MCP" → "Reconnect MCP Servers"
- Or restart Kiro entirely

## Common Kiro Issues

### Steering files not loading
- Check the `inclusion` field in the YAML front-matter
- `always` = loaded every time, `auto` = loaded when Kiro thinks it's relevant
- If a rule isn't being followed consistently, change `auto` to `always`

### Hooks not triggering
- Check the hook file is valid JSON (no trailing commas)
- Check the event type matches what you expect
- For `userTriggered` hooks, you need to click the hook button in the Agent Hooks panel

### Context getting lost between sessions
- Make sure you trigger "End of Session" before closing Kiro
- Check that `tracking/last-session-context.md` has recent content

## Your MCP Server Config
Located at: `.kiro/settings/mcp.json`
- **builder-mcp**: Enabled (install: `toolbox install builder-mcp`)
- **aws-sentral-mcp**: Disabled until installed (`toolbox install aws-sentral-mcp`)
- **aws-outlook-mcp**: Disabled until installed (see install commands in onboarding notes)
- **gandalf-mcp-server**: Disabled until installed (see install commands in onboarding notes)
- **slack-mcp**: Not configured (requires Node.js — add later when ready)
