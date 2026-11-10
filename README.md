# boardkit

[![tests](https://github.com/p2plus/boardkit/actions/workflows/tests.yml/badge.svg)](https://github.com/p2plus/boardkit/actions/workflows/tests.yml)

Zwei Dinge für den Unterricht, richtig gemacht: **ein Timer** und **faires Namen-Ziehen**. Eine Datei.

Teachers buy popsicle sticks with names on them and giant visual timers
— then the school computer can't install anything anyway. boardkit is
one HTML file: copy it to a USB stick, open it in any browser on any
school machine, project it on the beamer. No install, no server, no
account, nothing leaves the page. Hosted copy (for the Wi-Fi days):
**https://p2plus.github.io/boardkit/**

## Timer

Big countdown for Klassenarbeit and Stillarbeit. Presets (5–45 min) or
custom, Start/Pause/Reset, **+1 min** when the task needs it, tab title
shows the remaining time while you're in another window, end-of-time
beep, red over-time state. `F` toggles fullscreen.

## Namen

Paste your class list (one name per line, or comma/semicolon separated —
deduped automatically). Every draw pulls from the bucket; when it's
empty, the next draw starts round 2 — **everybody gets a turn before
anybody gets a second**. History of draws is visible to the class, so
it's demonstrably fair, and the list persists in `localStorage`.
`Leertaste` draws. `Alle zurück in den Becher` resets.

## Why one HTML file

Same reason as everything in this series: the audience can't install
software on school machines, but they always have a browser. The test
suite enforces the single-file property — it extracts the marked pure-JS
core out of `index.html` and fails if the core ever touches the DOM or
leaves the file.

## Honest limitations

- The beep needs a click first (browser autoplay rules); it fires on
  Start, which is always a click. Sound is a bonus, never a crash.
- The tab-title countdown stops updating if the tab is suspended by the
  OS — the on-screen clock keeps true because it's anchored to a wall
  time (`endAt`), not to ticks.
- `ß` and `ss` count as different names (lowercase dedup only). Nobody
  has complained yet; now it's documented.
- No attendance tracking, no seating charts, no grading — those are
  different tools and this one refuses to become a dashboard.

## Tests

    node --test     # 21 tests — timer state machine, clock format,
                    # name parsing, fair-bucket draw with seeded RNG

CI runs them on Node 20/22 across Linux, macOS, Windows.

## License

MIT.
