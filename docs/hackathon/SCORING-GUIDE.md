# Judging rubric — full version

The detailed criteria from the hackathon judging page. [RUBRIC.md](RUBRIC.md) is the organisers'
summary.

## 30 — Is it actually useful?

The purpose, and whether a real person would use it. This is the biggest single block of points, on
purpose.

- Can you name the person who needs this, specifically?
- Does it solve their problem, or a problem you assumed they had?
- Would they still use it next month?
- Does it connect to the theme honestly, or was "green" bolted on at the end?

Easy points: talk to two people outside your team before you start building, and put what they said
in your README.

## 20 — Does the demo work?

Live, end to end, without someone rescuing it. A small thing that runs beats a big thing that almost
runs.

- One complete path through the app, start to finish
- It survives being used by someone who did not build it
- Errors say something useful instead of crashing
- You know which parts are real and which are faked, and you say so

Easy points: record a 2-minute backup video.

## 20 — Is the AI doing real work?

Inside the product, not just in your editor. The two bonus lines are worth 5 of these 20 points.

- The app does something it could not do without AI
- It handles messy real input — photos, documents, half-finished sentences
- Bonus: several steps or agents each doing one job and passing work along
- Bonus: the AI uses a tool — searches, calculates, calls something out
- You handled the case where the AI is confidently wrong

Easy points: one clear diagram of what happens between the user's click and the answer.

## 15 — How did you build it?

Your choices, your workflow, your honesty.

- Sensible structure — someone new could find their way around
- You can explain why you chose this tool over that one
- Commits show real progress, not one giant dump at 3am (4 of the 15 points)
- You are straight about what AI generated and what you decided

## 10 — Can someone else understand it?

One README, one page, five sections:

- What it does, in two sentences
- Who it is for
- How to run it — the actual commands
- What is finished and what is not
- What you would build next with another week

## 5 — Does it hold up?

Some evidence you tried to break it.

- A few tests on the parts that matter most
- Or an honest list: what we tried, what broke, what we fixed
- What happens with an empty input, a huge file, a wrong language

Easy points: a "known issues" section.
