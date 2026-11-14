# כיכר החברים — Friends Square

A blocky 3D game that lets children practise everyday social skills. It is built for
children who find social situations hard (autism spectrum / Asperger, social anxiety,
or simple shyness), for boys and girls alike.

The game needs **no reading**: goals are shown as pictograms, and feedback comes from
the other children's faces and body language. Short Hebrew captions and Hebrew
narration are optional (buttons in the top-right corner).

## Run

    npm install      (first time only)
    npm start        then open http://localhost:5173

## Play

- Move: arrow keys / WASD, or the on-screen joystick on a tablet.
- Act: tap the round picture buttons (keyboard: Space = first button, 1-4 = buttons).
- Each island is one challenge. Passing it builds the bridge to the next island.
- Tap a station icon at the top to replay it and improve the star rating.
- Mistakes are never punished: the other child reacts naturally, the player tries
  again, and after two slips a visual hint appears.

## The twelve challenges

| # | Skill | What the child does |
|---|-------|---------------------|
| 1 | Personal space | Walk up, stop at a comfortable distance, wave hello |
| 2 | When is it OK to approach | Spot who is free (eye contact, smile) vs. busy |
| 3 | Joining a conversation | Stand nearby, wait for a pause, then greet |
| 4 | Hug, high-five or wave | Read the invitation; hold a hug for the right time |
| 5 | Waiting in line | Go to the end, wait, step forward only when there is room |
| 6 | Turn-taking in talk | Listen to the end, then answer on the same topic |
| 7 | Feelings | Name the feeling, then choose a helpful response |
| 8 | Playing together | Ask to join from the side; pass the ball to whoever is waiting |
| 9 | Good sportsmanship | Run a race, then respond well to losing and to winning |
| 10 | Handling teasing | Stay calm, say "stop" clearly, fetch an adult if it continues |
| 11 | It is OK to say no | Follow your own comfort: decline a hug politely, accept when you want to |
| 12 | Asking for help | Ask for a quiet break, for a hand, or to hear something again |

Guidance fades from round to round (e.g. the comfort-zone rings and the hug timer
disappear), so the child ends up relying on the social cues themselves.

The 👪 button opens a page for parents and therapists with one real-life practice idea
per challenge. Research on computer-based social-skills training finds that skills
carry over to daily life mainly when an adult practises them with the child.

## Section for ages 10-16

Choose "10-16" on the start screen (or open `/?mode=teen`). This section has its own
world (a waterside campus with realistic lighting, reflections and smooth characters),
its own saved progress, and eight challenges for older children:

| # | Skill | What the player does |
|---|-------|----------------------|
| 1 | Self-calming | Choose to breathe first, then follow a paced-breathing ring |
| 2 | Two-way conversation | Talk about a hobby, notice when the listener loses interest, ask about them |
| 3 | Teamwork | Share out roles by listening, combine two ideas, help fix a mistake |
| 4 | Compromise | Take turns, give way when it matters more to the friend, speak up when it is your turn |
| 5 | Respectful debate | Listen to the end, answer the point not the person, agree to disagree |
| 6 | Apology and forgiveness | Accept an apology, make a real one, give a hurt friend time |
| 7 | Peer pressure | A clear no, an alternative, and walking away to better company |
| 8 | Friends on screen | Do not forward an embarrassing photo, do not reply in anger, ask when tone is unclear |

## "Watch first" demonstration

Before a station that has not been passed yet, the player's own character acts out round one
on autopilot (yellow frame, 👀 banner, a 👆 finger on each button as it is pressed), then walks
back and hands over control. ⏭ or Esc skips it, the 👀▶ button replays it (restarting the
station), and the 👀 toggle turns automatic demonstrations off. Each station's script is its
`demoSteps()` method; the runner is in the `Challenge` base class in `js/challenges.js`.

## Code map

- `js/world_teen.js`, `js/challenges_teen.js` — the 10-16 section

- `js/world.js` — voxel islands, bridges, textures (all generated in code)
- `js/character.js` — blocky characters, pixel-art facial expressions, animations
- `js/challenges.js` — the twelve challenges (one class each) and the party island
- `js/strings.js` — all Hebrew text
- `js/main.js` — controls, camera, HUD, saved progress
