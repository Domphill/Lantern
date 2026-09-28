# Lantern

A private companion for mood check-ins, journaling, small goals, and support when things are hard.

Open it at **<https://domphill.github.io/lantern/>**. There is no account and nothing to install: it runs in your browser, and everything you write stays on your own device.

## Putting it on your phone

- **iPhone or iPad:** open the link in Safari, tap *Share*, then *Add to Home Screen*.
- **Android:** open the link in Chrome, tap the menu (three dots), then *Add to Home screen* or *Install app*.
- **Computer:** open the link in Chrome or Edge and use the install button at the right of the address bar, or just bookmark it.

Once it is on your home screen, Lantern opens like any other app and works without a connection.

## What it does

- **Today:** a quick check-in on how you're feeling, and small wins worth noticing.
- **Journal:** write freely, or use gentle prompts and CBT-style templates for unpicking a difficult thought.
- **Goals:** small goals and weekly habits, with no streaks to break.
- **Insights:** charts of your mood over time, and what seems to help.
- **Toolkit:** breathing, grounding, a self-compassion break, ideas for low days, and the PHQ-9 questionnaire.
- **Support:** people you can talk to right now, and a place for your own safety plan. It is at the top of every page.

You can look around with example data before writing anything of your own.

## Where your entries are kept

Everything stays in the browser, or the home-screen app, on the device you are using. Nothing is sent to a server: there is no account, no sign-in and no analytics.

- Each device keeps its own entries. To move them, use **Settings, Download a backup** on one device and **Settings, Restore from a backup** on the other.
- Clearing the browser's site data, or deleting the home-screen app, erases the entries on that device. Download a backup now and then.
- If you share the device, turn on the app lock.

## App lock

**Settings, Privacy and lock** turns on a passcode. Everything is then encrypted on the device before it is saved. Keep the recovery code it shows you: without the passcode or the recovery code, locked entries cannot be opened by anyone, including you.

## If things get hard

- Emergency: **999**, or go to A&E
- Samaritans, any time: **116 123**
- Shout, text any time: **SHOUT to 85258**
- NHS urgent mental health, 24/7 (England): **111, option 2**
- CALM, 5pm to midnight: **0800 58 58 58**

Lantern is a self-help tool. It isn't a medical device and doesn't replace your GP or therapist.

## Notes for making changes

- `src/` holds the app: plain JavaScript and CSS, with no build step. Open `index.html` to run it locally.
- `sw.js` caches the app so it opens offline. After changing any file, bump `VERSION` in `sw.js`, or phones keep using the old copy.
- `manifest.webmanifest` and `icons/` are what phones use to add Lantern to the home screen.
- `build.ps1` makes `dist/lantern.html`, a single-file version of the app for hosts that take one HTML page.
- Fonts are Alegreya and Alegreya Sans (SIL Open Font License), served from `fonts/`, so no request leaves the site.
- Helplines were checked on 24 September 2026.
