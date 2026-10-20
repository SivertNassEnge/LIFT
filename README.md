# Lift – a simple workout tracker

Lift is a workout tracker that runs in the browser. It is inspired by gym apps, but it is my own design and code. It was built for Mandatory Assignment 3 (Vibe Coding) in DAVE3625 at OsloMet.

## Features

- **Log a workout:** start a workout, add exercises, and log kg and reps for each set. A live timer and the total kg are shown at the top.
- **Last time in grey:** when you add an exercise you have done before, last time's kg and reps are shown in grey inside the fields. This makes progressive overload easy.
- **How to:** every exercise has a "How to" button with a drawing of the movement (start and end position) and three simple steps.
- **Muscle map:** after a workout, a body map shows which muscles you trained. More sets means a stronger red colour.
- **Personal records:** the app detects new PRs and celebrates them with confetti.
- **Progress:** graphs for each exercise (estimated 1 rep max), volume per week, and a muscle map for the last 7 days.
- **History:** every saved workout gets a title. Tap a workout to see all sets and muscles worked.
- **Two themes:** Graphite (dark grey) and Sand (light beige).

All data is saved in your own browser (localStorage). There is no login, no server and no personal data.

## How to run

Open `index.html` in a browser. On a computer the app is shown inside an iPhone frame. On a phone it fills the screen, and you can use "Add to Home Screen" to use it like an app.

## How AI was used

The app was built with vibe coding, using Claude. I described what I wanted in plain language (features, style and design). The AI wrote the code, and I tested every version in the browser. When something did not work, I described the problem and the AI fixed it. For example:

- Finishing a workout without checking the sets removed all exercises. This was fixed so filled sets are saved.
- The phone frame did not fit on smaller screens, and the Exercises page made the frame too wide.
- I asked for drawn figures instead of photos, a lighter colour theme, a workout title and total kg.

## Credits

- Exercise data and drawings: [Everkinetic](https://github.com/everkinetic/data) by Greg Priday, licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The names and muscle groups have been simplified for this app.
- The muscle map is drawn for this project.
