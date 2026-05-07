---
inclusion: auto
description: Astro pipeline stages, rules, escalation criteria, and pipeline hygiene standards
---

# Pipeline Management — Astro

## Pipeline Stages

### BD (Business Development)
- **Entry**: Seller identified as potential (from lead list, referral, or self-registration)
- **Activities**: First outreach sent, waiting for response
- **Exit criteria**: Seller responds and shows interest in onboarding
- **Max time in stage**: 3 weeks (then mark as unresponsive or re-engage)

### Evaluation
- **Entry**: Seller responded, onboarding call scheduled or completed
- **Activities**: Onboarding call, first product listing guidance, initial setup
- **Exit criteria**: Seller has first product live and buyable on Amazon.com.br
- **Max time in stage**: 4 weeks (then escalate or flag as stalled)

### Closed Won
- **Entry**: Seller has launched — first product is live and buyable
- **Activities**: Growth lever activation, ongoing support
- **Exit criteria**: N/A — this is the final positive stage
- **Note**: Only move here when the seller has ACTUALLY launched. Not when they promise to.

### Closed Lost (if applicable)
- **Entry**: Seller explicitly declines or becomes permanently unresponsive
- **Note in opportunity**: Reason for loss (not interested, went to competitor, technical issues, etc.)

---

## Pipeline Hygiene Rules

### Every Opportunity Must Have
- Seller name and store name
- Current stage (accurate, not stale)
- Last contact date
- Next action and next action date
- Notes from most recent interaction

### Stalled Opportunity Criteria
An opportunity is **stalled** if:
- **BD stage**: No response after 3 outreach attempts over 2+ weeks
- **Evaluation stage**: No progress toward first listing in 3+ weeks
- **Any stage**: No notes updated in 2+ weeks

### Stalled Opportunity Actions
1. Send final follow-up (email + WhatsApp)
2. If no response in 5 business days → move to "On Hold" or "Closed Lost"
3. Document reason in opportunity notes
4. Review stalled opportunities weekly during pipeline review

---

## Weekly Pipeline Review Checklist

Every Friday (or during weekly team sync):
- [ ] Review all BD opportunities — any ready to move to Evaluation?
- [ ] Review all Evaluation opportunities — any ready for Closed Won?
- [ ] Identify stalled opportunities (2+ weeks no movement)
- [ ] Update notes on all active opportunities
- [ ] Count: How many in each stage?
- [ ] Plan: Next week's outreach and follow-up priorities

---

## Pipeline Metrics to Track

| Metric | How to Calculate | Target |
|--------|-----------------|--------|
| Conversion rate (BD → Evaluation) | Evaluation / BD total | 30-40% |
| Conversion rate (Evaluation → Closed Won) | Closed Won / Evaluation total | 50-60% |
| Average time in BD | Days from first outreach to response | < 14 days |
| Average time in Evaluation | Days from response to first listing | < 21 days |
| Pipeline velocity | New Closed Won per week | Varies by target |
| Stalled rate | Stalled / Total active | < 15% |

---

## Opportunity Notes Best Practices

### Good Note Example
```
2026-05-04: Called seller, walked through first listing for category Electronics.
Seller will list 3 products by Friday. Needs help with image requirements.
Next action: Follow up Friday to check listing status.
```

### Bad Note Example
```
Called seller. Will follow up later.
```

### Note Template
```
[DATE]: [INTERACTION TYPE — call/email/WhatsApp]
Summary: [What was discussed/decided]
Seller action items: [What seller committed to]
My action items: [What I need to do]
Next action: [Specific next step + date]
```
