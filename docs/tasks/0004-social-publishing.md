# 0004: Announce selected R&D posts on social media

- **Status:** in review
- **Requirements:** R-15, Q-01, Q-08
- **Decisions:** ADR 0020
- **Model:** main session
- **PR:** [#32](https://github.com/EmilianoManaloIV/EmilianoManaloIV.github.io/pull/32)

## Goal
The owner can opt an R&D article into Instagram, LinkedIn and X announcements with one Discussion label. Validate the entire path on a sample article before the owner merges.

## Context and scope
R&D already publishes from the owner's Discussions. Extend the Pages workflow with a job that hands announcements to Buffer after a successful deployment. Use the article's first compatible JPEG or a branded fallback for Instagram. The owner connects the accounts and enables publishing after the merge.

## Deliverables and acceptance
1. Only R&D articles by the owner bearing `share: social` are eligible. The job verifies the live URL and current label before submitting.
2. The default dry run shows the three announcements and makes no Buffer calls or status writes. A failed deploy skips the job.
3. Channel-level records prevent repeat submissions across edits, renames, retries and rebuilds. A definitive rejection or an ambiguous submission requires channel-specific recovery. Other channels can still submit.
4. Run the end-to-end fixture case against a mocked Buffer API. Show the exact text and image in the PR. Run all three build and test chains and record the site budgets.
5. Document setup, account requirements, pausing and recovery in the manual. The owner merges the PR and controls activation.

## After the review
The review found that a retry could see an image path recycled for a comment attachment. The fixture now replays this case against the newer page. Each candidate carries a revision, and the author-supplied image path carries its digest. Eligibility is checked again just before each channel's claim and submission.

The publishing workflow runs separately from Pages and verifies the same upstream attempt that produced the manifest. Claim records now include the target channel, time, article URL and revision. Tests remove the label both during a preceding channel's request and during the claim write. The manual explains how to reconcile pending claims. Instagram personal accounts are rejected before a create-post request.
