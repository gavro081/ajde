# AI Student Hackathon 2026

Welcome to the **AI Student Hackathon**, part of **AI Tech Summit "Filip Avramchev" 2026** in Skopje — [techsummit.ai](https://techsummit.ai/).

Around 16 teams, five days, one theme:

> **Go green. Be helpful. Build something the community can use.**

Build a working project and keep your code, documentation, and demo recordings in your team repository.

**Submission deadline: 22 September 2026, 15:00 (Skopje local time).** Team repositories become read-only at that time. Everything you want judged must be **pushed to GitHub** before the deadline; a commit saved only on your laptop does not count.

The three best teams present again on the **Main Stage on 23 September**.

## Start here

1. Accept your GitHub organisation invitation (details below).
2. [Set up Git](git.md) with your name and email.
3. [Connect to GitHub with SSH](ssh.md), then [clone your team repository](git.md#clone-your-team-repository).
4. [Redeem your OpenAI Pro Lite code](openai-redemption.md), sent to you individually over chat. **Read the billing warning before redeeming.**
5. Read the judging rubric and submission checklist below, then start building.

> [!WARNING]
> **OpenAI offer: one month free, with a credit card required in the organiser's tested checkout.** Billing details include an address. A $0 redemption does not mean future months are free. After the hackathon, cancel before the renewal date shown in your account to avoid a possible charge. See the [redemption and cancellation guide](openai-redemption.md).

---

## How this organisation works

- **Every team member is invited to this organisation.** Accept the invitation from your email or
  from <https://github.com/AI-Tech-Summit-Filip-Avramchev> — until you accept, you cannot see
  anything here.
- **Every team gets its own repository.** Only your team can write to it. You will not see other
  teams' code, and they will not see yours.
- **This repository is the template** your team repo was created from. Read it, then work in *your*
  repo — not this one.
- **Everything you submit lives in your team repo.** There is no separate upload, no zip file, no
  email. What is pushed by the deadline is what gets judged.

**Your team repo looks like this:**

```
git@github.com:AI-Tech-Summit-Filip-Avramchev/<your-team-name>.git
```

Your mentor will tell you the exact name on day one.

---

## How you will be judged

An AI reviewer reads your repository and scores it against the rubric below — the same way for every
team. Then the human jury reads that report, watches your demo, and decides. **The AI does not pick
the winners.** It makes sure nobody's work gets skimmed.

Everything it says must point at a real file and real lines in your repo. If it cannot find the
evidence, it cannot give you the points.

### The rubric — six things, 100 points

| Points | What we ask | In short |
|---:|---|---|
| **30** | Is it actually useful? | Can you name the person who needs this? Would they still use it next month? |
| **20** | Does the demo work? | One complete path through the app, start to finish, without someone rescuing it |
| **20** | Is the AI doing real work? | The app does something it could not do without AI — not a chat box in the corner |
| **15** | How did you build it? | Sensible structure, real commits, and honesty about what AI generated |
| **10** | Can someone else understand it? | One README: what it does, who for, how to run it, what is finished |
| **5** | Does it hold up? | Some evidence you tried to break it |

The full version, with what earns points in each one, is on the hackathon judging page — **your
mentor has the link**. Read it on **day one**, not day five.

### About your commits specifically

**This earns points:** commits spread across the build days rather than one dump on the last night,
messages that say what changed, a bug followed by the commit that fixes it, and any trace of review.
That is part of *How did you build it?* — 4 of those 15 points.

**This is recorded but never scored:** *who* committed what, how the work was split, whether
everyone's commits are linked to a GitHub account, and how many pull requests or issues you opened.

One person pushing for a pair is normal. Sharing a laptop is normal. You are not penalised for it,
and **you should not invent commits to look busier**. The jury does see your commit timeline and who
authored what, and they may ask about it on the day. Answer honestly — there is no wrong shape.

### Using AI to write your code is allowed and expected

Say so. *"We used AI to write most of the frontend so we could spend our time on the matching logic"*
is a strong answer. Pretending otherwise is a weak one — and the reviewer can usually tell.

---

## What your README should say

Your repo's README is worth **10 points**, and it is the first thing anyone reads. One page. Five
sections:

1. **What it does** — two sentences, no jargon
2. **Who it is for** — a specific person, not "everyone"
3. **How to run it** — the actual commands, and any environment variables needed
4. **What is finished and what is not** — an honest "known issues" list costs you nothing and reads
   as confidence
5. **What you would build next** with another week

Then have someone from **another team** follow your run instructions on their laptop. Whatever
breaks, fix in the README. That is the cheapest 10 points at the event.

---

## Before you submit

- [ ] The repo is accessible and the link works from someone else's account
- [ ] README says what it does, who for, and how to run it
- [ ] Someone outside your team ran it successfully
- [ ] A backup demo recording exists
- [ ] The main flow works on a phone, not just your laptop
- [ ] Your architecture diagram or sketch is in the repo
- [ ] Known issues are written down, not hidden
- [ ] Everyone can explain the whole project, not just their part
- [ ] Everything is **pushed** — run `git push`, then check GitHub shows your latest commit and all submission files

---

## Need help?

**Ask your mentor first** — that is what they are there for, and asking on day two is much better
than asking on day four.

Event questions: [info@techsummit.ai](mailto:info@techsummit.ai)

Good luck. Build something someone will actually use.
