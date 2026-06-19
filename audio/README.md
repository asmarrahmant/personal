# Background music

Drop your audio file in this folder and point `data.json` → `music.file` at it.

By default the site looks for **`audio/background.mp3`** — so the simplest setup is to
name your file exactly `background.mp3` and place it here. (MP3 is the safest format for
broad browser support; `.ogg`/`.m4a` also work.)

## Controls (in `data.json` → `"music"`)
| Field | What it does |
|-------|--------------|
| `mode` | `"play"` = feature on · `"don't play"` = feature off (no audio, no button) |
| `file` | path to the audio, e.g. `audio/background.mp3` |
| `volume` | 0.0–1.0 (default `0.35` — keep it subtle) |
| `loop` | `true` to repeat forever (default) |

## How it behaves
- Tries to autoplay; browsers block sound until the visitor interacts, so it starts on
  their **first click / scroll / keypress** instead.
- **Loops** continuously.
- **Pauses** when the visitor switches to another tab or leaves, **resumes** when they return.
- A small **speaker button** in the nav lets visitors mute/unmute (remembered across visits).
