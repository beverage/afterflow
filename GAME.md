# GAME.md: living design doc

Single source of truth for humans and agents. Keep it short and current: when a decision changes, change it here and log the why in `DECISIONS.md`.

## One-liner

_Name: one sentence built on a verb. Example: "Dodge falling orbs with one thumb while an AI announcer roasts your run."_

## Core loop (what the player does every few seconds)

1.
2.
3.

## The AI hook (why this is an AI game, not a game with AI bolted on)

- What Gemini generates or decides:
- When it is called (never per frame):
- What the player sees if the AI is slow or offline (fallback):

## Controls

- Touch:
- Desktop:

## Look and sound

- Mood / palette:
- Assets (key -> file): `player` -> `assets/player.png`, `hazard` -> `assets/hazard.png`
- Art owner:

## Voices (Gradium)

| Character | Key in `src/voices.js` | Voice | Design prompt / notes |
|---|---|---|---|
| Narrator | `narrator` | Emma (catalog) | Placeholder until we design our own |
| | | | |

## Scope

- Must have for the demo:
- Nice to have:
- Cut (not today):

## Team

| Who | Owns |
|---|---|
| Alex | Repo, integration, AI wiring, deploy, the demo build |
| | Game design, pitch |
| | Art, audio, UI |

## Clock (Paris time)

- 11:00 skeleton deployed at a public URL
- 12:30 ugly but playable core loop (lunch)
- 15:00 AI hook working end to end
- 17:30 feature freeze: only fixes and polish after this
- 18:30 record a backup demo video of a good run
- 19:00 competition opt-in deadline
- 20:00 live demo

## Demo (2 minutes, rehearse once at 18:45)

1. Hook, one sentence:
2. Play it live:
3. The AI moment:

## Decisions

This file is the current state. The why behind each choice lives in `DECISIONS.md`.
