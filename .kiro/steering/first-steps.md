---
inclusion: manual
description: Getting started guide — first things to try with Kiro after setup is complete
---

# First Steps — Getting Started with Kiro

## Your Setup Status
Your workspace has 4 MCP servers configured (builder, outlook, sentral, gandalf) and 13 steering files. This guide walks you through actually using them.

Work through these in order. Each one builds confidence with a different part of your toolkit.

---

## Step 1: Verify MCP Servers Are Working (5 min)

Test each server with a simple command. If any fail, check `#first-aid`.

### Builder MCP
Ask Kiro:
> "Look up my alias on phonetool"

Expected: Returns your employee info from phonetool.

### AWSentral MCP
Ask Kiro:
> "Get my personal details from Salesforce"

Expected: Returns your alias and Salesforce User ID.

### Outlook MCP
Ask Kiro:
> "Show my last 5 emails"

Expected: Returns recent inbox items.

### Gandalf MCP (Excel)
This one needs an open Excel file. Skip for now if you don't have one ready — you'll use it when building reports.

---

## Step 2: Pull Your Pipeline (10 min)

This is your daily bread and butter. Try:

> "Show me my Astro pipeline — how many opportunities do I have in each stage?"

Or if you know a specific account:
> "Search for account [SELLER NAME] in Salesforce"

What to look for:
- Does the data match what you see in Astro?
- Are opportunity stages current?
- Any sellers you need to follow up with?

---

## Step 3: Draft Your First Email (5 min)

Pull in the email templates and try:

> `#email-templates` Draft a first outreach email for a seller named Maria Silva who sells electronics in São Paulo

What to look for:
- Email is in Portuguese
- Personalized with seller name and category
- Professional but warm tone
- Clear call to action

---

## Step 4: Check Your Calendar (5 min)

> "What's on my calendar this week?"

Or:
> "Do I have any onboarding calls scheduled?"

This helps you plan your week and prep for upcoming seller calls.

---

## Step 5: Send a Test Status Update (5 min)

Pull in the leadership templates and try:

> `#leadership-status-updates` Draft a weekly status update. I launched 3 sellers this week, have 15 in BD and 10 in Evaluation. Main win was converting 2 Meli Badge sellers. Blocker is category approval delays in Electronics.

What to look for:
- Concise, scannable format
- Numbers front and center
- Clear ask for the blocker

---

## Step 6: Try End of Session (2 min)

When you're done for the day:

> "End of session"

This saves your context to `tracking/last-session-context.md` so next time you open Kiro, I'll remember what you were working on.

---

## Daily Quick Start Routine

Once you're comfortable, your daily Kiro session should look like:

1. **Open Kiro** — I'll automatically read your last session context
2. **"Pipeline update"** — Quick view of your Astro pipeline
3. **"What's on my calendar today?"** — Check for onboarding calls
4. **"Check my inbox for seller replies"** — Scan for responses
5. **Do your work** — Draft emails, prep calls, update pipeline
6. **"End of session"** — Save context before closing

---

## Useful Commands to Remember

| What You Want | What to Say |
|--------------|-------------|
| Check pipeline | "Pipeline update" or "Show my opportunities" |
| Draft outreach email | `#email-templates` "Draft outreach for [seller]" |
| Prep for a call | "Prep onboarding call for [seller]" |
| Weekly status | `#leadership-status-updates` "Draft weekly status" |
| Monthly report | `#reporting-templates` "Start monthly report for [month]" |
| Search a seller | "Search for [seller name] in Salesforce" |
| Check calendar | "What's on my calendar today/this week?" |
| Read an email | "Show me emails from [person]" |
| Save context | "End of session" |
| Troubleshoot | "Something isn't working" — I'll check `#first-aid` |

---

## Steering Files — Quick Reference

### Always Loaded (you don't need to do anything)
- `role-context` — Your role and responsibilities
- `assistant-context` — How I work with you
- `common-workflows` — Daily routines and commands
- `engineering-principles` — Quality standards

### Auto-Loaded (I pull these in when relevant)
- `pipeline-management` — Astro stages and hygiene rules
- `seller-activation-playbook` — Growth lever guides
- `stakeholder-tracking` — Cross-org contacts and escalation
- `quick-links` — Internal URLs
- `first-aid` — Troubleshooting

### Manual (use `#filename` to pull in)
- `#email-templates` — Portuguese outreach/activation templates
- `#reporting-templates` — Monthly report and metrics framework
- `#leadership-status-updates` — Weekly status and escalation formats
- `#end-of-session` — Session saving process
- `#first-steps` — This guide

---

## What's Next After First Steps

Once you're comfortable with the basics:

1. **Build your stakeholder contact list** — Use the template in `#stakeholder-tracking` to fill in real POC names
2. **Customize email templates** — Adjust the templates in `#email-templates` to match your voice
3. **Set up your first hook** — e.g., auto-lint or auto-remind on file save
4. **Try Excel automation** — Open a QuickSight export in Excel and ask Kiro to analyze it with Gandalf
5. **Batch outreach** — Ask Kiro to draft 10 personalized outreach emails from a seller list

---

## Getting Help

- **Something broke?** → Say "something isn't working" and I'll troubleshoot
- **Need a template?** → Use `#` to pull in the right steering file
- **Lost context?** → Check `tracking/last-session-context.md`
- **MCP server down?** → Ctrl+Shift+P → "Reconnect MCP Servers"
- **General Kiro help** → https://w.amazon.com/bin/view/Users/winfreyl/KiroProductivityGuide/
