/* Lantern — Settings: you, appearance, privacy and lock, reminders, your data. */
(function (L) {
  'use strict';
  const U = L.util;
  const K = L.content;
  const UI = L.ui;
  const h = UI.h;
  const D = L.data;
  const R = L.router;
  const C = L.crypto;
  const V = (L.views = L.views || {});
  const drafts = (L.drafts = L.drafts || {});

  /* ---------- lock flows ---------- */
  function passField(id, label, opts) {
    opts = opts || {};
    return UI.field(
      label,
      h('input.input', {
        id,
        type: 'password',
        autocomplete: opts.autocomplete || 'new-password',
        minlength: 4,
        maxlength: 128,
        'data-autofocus': opts.autofocus ? '' : null
      }),
      opts.help
    );
  }
  const val = (id) => {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };

  function recoveryPanel(code, onDone) {
    const box = h('div.recovery');
    const ack = h('input#rc-ack', { type: 'checkbox' });
    const done = UI.btn('Done', onDone, { kind: 'primary', disabled: true });
    ack.addEventListener('change', () => {
      done.disabled = !ack.checked;
    });
    box.appendChild(h('p', 'This recovery code is the only way back in if you forget your passcode. Write it down, or save it somewhere private, like a password manager.'));
    box.appendChild(h('p.recovery-code', { 'aria-label': 'Recovery code ' + code.split('').join(' ') }, code));
    box.appendChild(
      h(
        'div.actions',
        UI.btn('Copy', () => UI.copy(code, 'Recovery code'), { small: true, icon: 'copy' }),
        UI.btn('Save as a file', async () => {
          try {
            const r = await UI.download('lantern-recovery-code.txt', 'Lantern recovery code\r\n\r\n' + code + '\r\n\r\nUse this if you forget your Lantern passcode. Keep it private.\r\n', 'text/plain');
            if (r === 'saved') UI.toast('Recovery code saved');
          } catch (e) {
            UI.toast(e.message);
          }
        }, { small: true, icon: 'download' })
      )
    );
    box.appendChild(h('label.check-row', ack, h('span', 'I’ve saved my recovery code somewhere safe')));
    box.appendChild(h('div.actions', done));
    return box;
  }

  function setupLock(afterDone) {
    const err = h('p.form-error', { role: 'alert' });
    const progress = h('p.muted', { 'aria-live': 'polite' });
    const body = h(
      'div.form',
      h('p', 'With a passcode, everything in Lantern is encrypted on this device before it’s saved. Anyone who opens Lantern will need the passcode to see your entries.'),
      passField('lock-new', 'Choose a passcode', { autofocus: true, help: 'At least 4 characters. A short phrase is safer than 4 numbers.' }),
      passField('lock-new2', 'Type it again'),
      D.backend && D.backend.name === 'cloud' ? h('p.help', 'If Lantern is open on another device, close it there first.') : null,
      err,
      progress
    );
    let busy = false;
    const s = UI.sheet({
      title: 'Turn on app lock',
      body,
      actions: [
        UI.btn('Cancel', () => !busy && s.close(), { kind: 'ghost' }),
        UI.btn('Turn on lock', async () => {
          if (busy) return;
          const a = val('lock-new');
          const b = val('lock-new2');
          if (a.length < 4) return (err.textContent = 'Use at least 4 characters.');
          if (a !== b) return (err.textContent = 'Those two don’t match. Try again.');
          err.textContent = '';
          busy = true;
          progress.textContent = 'Protecting your entries…';
          try {
            const code = await D.enableLock(a, (n, total) => {
              progress.textContent = 'Protecting your entries… ' + n + ' of ' + total;
            });
            UI.clear(s.panel.querySelector('.sheet-body'));
            const actions = s.panel.querySelector('.sheet-actions');
            if (actions) actions.remove();
            s.panel.querySelector('.sheet-body').appendChild(
              recoveryPanel(code, () => {
                s.close();
                UI.toast('App lock is on.');
                if (afterDone) afterDone();
              })
            );
          } catch (e) {
            busy = false;
            progress.textContent = '';
            err.textContent = 'The lock couldn’t be turned on: ' + (e.message || e) + '. Nothing has changed.';
          }
        }, { kind: 'primary' })
      ]
    });
  }
  V.setupLock = setupLock;

  function changePasscode() {
    const err = h('p.form-error', { role: 'alert' });
    const s = UI.sheet({
      title: 'Change passcode',
      body: h('div.form', passField('pc-old', 'Current passcode', { autofocus: true, autocomplete: 'current-password' }), passField('pc-new', 'New passcode', { help: 'At least 4 characters.' }), passField('pc-new2', 'Type the new one again'), err),
      actions: [
        UI.btn('Cancel', () => s.close(), { kind: 'ghost' }),
        UI.btn('Change passcode', async () => {
          const a = val('pc-new');
          if (a.length < 4) return (err.textContent = 'Use at least 4 characters.');
          if (a !== val('pc-new2')) return (err.textContent = 'The new passcodes don’t match.');
          try {
            await C.unlockWithPasscode(D.meta, val('pc-old'));
          } catch (e) {
            return (err.textContent = 'Your current passcode isn’t right.');
          }
          try {
            await D.changePasscode(a);
            s.close();
            UI.toast('Passcode changed. Your recovery code still works.');
          } catch (e) {
            err.textContent = 'Couldn’t save the new passcode: ' + (e.message || e);
          }
        }, { kind: 'primary' })
      ]
    });
  }

  function turnOffLock() {
    const err = h('p.form-error', { role: 'alert' });
    const progress = h('p.muted', { 'aria-live': 'polite' });
    let busy = false;
    const s = UI.sheet({
      title: 'Turn off app lock',
      body: h('div.form', h('p', 'Your entries will be saved without encryption, and anyone who opens Lantern will be able to read them.'), passField('off-pass', 'Passcode', { autofocus: true, autocomplete: 'current-password' }), err, progress),
      actions: [
        UI.btn('Cancel', () => !busy && s.close(), { kind: 'ghost' }),
        UI.btn('Turn off lock', async () => {
          if (busy) return;
          try {
            await C.unlockWithPasscode(D.meta, val('off-pass'));
          } catch (e) {
            return (err.textContent = 'That passcode isn’t right.');
          }
          busy = true;
          try {
            await D.disableLock((n, t) => (progress.textContent = 'Updating your entries… ' + n + ' of ' + t));
            s.close();
            UI.toast('App lock is off.');
          } catch (e) {
            busy = false;
            err.textContent = e.message || String(e);
          }
        }, { kind: 'danger' })
      ]
    });
  }

  /* ---------- reminders ---------- */
  function icsFor(time) {
    const [hh, mm] = time.split(':').map(Number);
    const start = new Date();
    start.setDate(start.getDate() + 1);
    const d = U.dayKey(start).replace(/-/g, '');
    const t = U.pad2(hh) + U.pad2(mm) + '00';
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Lantern//Wellbeing//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:lantern-checkin-' + U.uid() + '@lantern.local',
      'DTSTAMP:' + stamp,
      'DTSTART:' + d + 'T' + t,
      'DURATION:PT5M',
      'RRULE:FREQ=DAILY',
      'SUMMARY:Check in with Lantern',
      'DESCRIPTION:A minute to notice how you’re feeling.',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Check in with Lantern',
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
      ''
    ].join('\r\n');
  }
  function googleLink(time) {
    const [hh, mm] = time.split(':').map(Number);
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(hh, mm, 0, 0);
    const end = new Date(start.getTime() + 5 * 60000);
    const f = (x) => U.dayKey(x).replace(/-/g, '') + 'T' + U.pad2(x.getHours()) + U.pad2(x.getMinutes()) + '00';
    const q = new URLSearchParams({
      action: 'TEMPLATE',
      text: 'Check in with Lantern',
      details: 'A minute to notice how you’re feeling.',
      dates: f(start) + '/' + f(end),
      recur: 'RRULE:FREQ=DAILY'
    });
    return 'https://calendar.google.com/calendar/render?' + q.toString();
  }

  /* ---------- data ---------- */
  function journalMarkdown() {
    const J = V.journalText;
    const entries = D.list('journal').sort(U.byAsc((e) => e.ts));
    const out = ['# My Lantern journal', '', 'Exported ' + U.fmtLongYear(new Date()) + '. ' + U.plural(entries.length, 'entry', 'entries') + '.', ''];
    for (const e of entries) {
      const tpl = K.template(e.template);
      out.push('## ' + U.fmtLongYear(e.ts) + ', ' + U.fmtTime(e.ts) + ' · ' + tpl.name, '');
      if (e.title) out.push('**' + e.title.trim() + '**', '');
      if (e.prompt) out.push('> ' + e.prompt, '');
      if (e.mood) out.push('*Feeling ' + K.moodLabel(e.mood).toLowerCase() + '*', '');
      for (const f of tpl.fields) {
        const t = J.fieldText(e, f).trim();
        if (!t) continue;
        if (f.label) out.push('**' + f.label + '**', '');
        out.push(t, '');
      }
    }
    return out.join('\n');
  }

  async function downloadBackup() {
    const text = JSON.stringify(D.exportData(), null, 2);
    try {
      const r = await UI.download('lantern-backup-' + U.todayKey() + '.json', text, 'application/json');
      if (r === 'saved') {
        await D.setPrefs({ lastBackup: U.nowIso() });
        UI.toast(D.meta ? 'Backup saved. It isn’t protected by your passcode, so keep it private.' : 'Backup saved.');
      }
    } catch (e) {
      UI.toast(e.message);
    }
  }

  async function restoreBackup() {
    const file = await UI.pickFile('.json,application/json');
    if (!file) return;
    let obj = null;
    try {
      obj = JSON.parse(file.text);
    } catch (e) {
      UI.toast('That file couldn’t be read as a backup.');
      return;
    }
    const check = D.readImport(obj);
    if (!check.ok) {
      UI.toast(check.error);
      return;
    }
    const c = check.counts;
    const summary = [
      U.plural(c.checkins, 'check-in'),
      U.plural(c.journal, 'journal entry', 'journal entries'),
      U.plural(c.goals, 'goal'),
      U.plural(c.wins, 'win'),
      U.plural(c.tests, 'questionnaire result')
    ].join(', ');
    let mode = 'merge';
    const s = UI.sheet({
      title: 'Restore from backup',
      body: h(
        'div.form',
        h('p', 'This backup' + (obj.exportedAt ? ' from ' + U.fmtLongYear(obj.exportedAt) : '') + ' holds ' + summary + '.'),
        h(
          'div.field',
          h('span.label', 'What should happen?'),
          UI.segmented({
            label: 'Restore mode',
            value: 'merge',
            options: [
              { value: 'merge', label: 'Add to what’s here' },
              { value: 'replace', label: 'Replace everything' }
            ],
            onChange: (v) => (mode = v)
          }),
          h('span.help', 'Adding keeps everything you have and brings in anything new or more recent from the backup.')
        )
      ),
      actions: [
        UI.btn('Cancel', () => s.close(), { kind: 'ghost' }),
        UI.btn('Restore', async () => {
          if (mode === 'replace') {
            const ok = await UI.confirm({ title: 'Replace everything?', body: 'Everything currently in Lantern will be removed and replaced with the backup.', confirm: 'Replace', danger: true });
            if (!ok) return;
          }
          s.close();
          UI.toast('Restoring…');
          try {
            const n = await D.importData(obj, mode);
            UI.toast('Restored ' + U.plural(n, 'item') + '.');
            L.app.render();
          } catch (e) {
            UI.toast('Restore failed: ' + (e.message || e));
          }
        }, { kind: 'primary' })
      ]
    });
  }

  async function eraseEverything() {
    const ok = await UI.confirm({
      title: 'Erase everything?',
      body: 'Every check-in, journal entry, goal and setting in Lantern will be permanently deleted' + (D.backend && D.backend.name === 'cloud' ? ' from your account, on every device' : ' from this browser') + '. Download a backup first if you might want it later.',
      confirm: 'Erase everything',
      danger: true,
      typed: 'ERASE'
    });
    if (!ok) return;
    await D.eraseAll();
    for (const k of Object.keys(drafts)) delete drafts[k];
    UI.toast('Everything has been erased.');
    L.app.enter();
  }

  function storageText() {
    const mode = L.app.mode;
    if (L.app.demo) return 'You’re looking at example data. Nothing you do here is saved, and your real entries are untouched.';
    if (mode === 'cloud')
      return 'Your entries are saved to your claude.ai account in a private space that only you can read, so they appear wherever you open Lantern while signed in. With the app lock on, everything is encrypted on your device before it’s saved.';
    if (mode === 'memory') return 'This browser isn’t letting Lantern save anything, so your entries will be lost when you close this page. Download a backup before you go.';
    if (L.env.standalone) return 'Your entries are saved in this app on this device, and nothing is sent anywhere. Removing Lantern from your home screen would erase them, so download a backup now and then.';
    return 'Your entries are saved in this browser on this device, and nothing is sent anywhere. Clearing your browser’s site data would erase them, so download a backup now and then.';
  }

  /* ---------- view ---------- */
  V.settings = {
    live: true,
    render(root) {
      const p = D.profile();
      const prefs = D.state.prefs;
      root.appendChild(h('div.page-head', h('h1.page-title', 'Settings')));

      /* You */
      const nameInput = h('input.input#set-name', {
        type: 'text',
        maxlength: 40,
        autocomplete: 'given-name',
        placeholder: 'Your first name',
        value: p.name || '',
        onchange: (e) => D.updateProfile({ name: e.target.value.trim() })
      });
      root.appendChild(h('section.card.set-sec', h('h2.card-title', 'You'), UI.field('What should Lantern call you?', nameInput, 'Used in greetings. Leave it blank if you prefer.')));

      /* Appearance */
      root.appendChild(
        h(
          'section.card.set-sec',
          h('h2.card-title', 'Appearance'),
          UI.segmented({
            label: 'Theme',
            value: prefs.theme || 'system',
            options: [
              { value: 'system', label: 'Match my device' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' }
            ],
            onChange: async (v) => {
              L.app.applyTheme(v);
              await D.setPrefs({ theme: v });
            }
          })
        )
      );

      /* Privacy */
      const priv = h('section.card.set-sec', h('h2.card-title', 'Privacy and lock'), h('p', storageText()));
      if (!L.app.demo) {
        if (!C.available()) {
          priv.appendChild(h('p.muted', 'App lock needs a secure connection, which this view doesn’t have.'));
        } else if (D.meta) {
          priv.appendChild(h('p.status-line', UI.icon('lock'), 'App lock is on. Your entries are encrypted.'));
          priv.appendChild(
            h(
              'div.field',
              h('span.label', 'Lock again after Lantern has been in the background for'),
              UI.segmented({
                label: 'Auto-lock',
                value: prefs.autoLock,
                options: [
                  { value: 1, label: '1 min' },
                  { value: 5, label: '5 min' },
                  { value: 15, label: '15 min' },
                  { value: 60, label: '1 hour' },
                  { value: 0, label: 'Never' }
                ],
                onChange: (v) => D.setPrefs({ autoLock: v })
              })
            )
          );
          priv.appendChild(
            h(
              'div.actions',
              UI.btn('Lock now', () => L.app.lock(), { small: true, icon: 'lock' }),
              UI.btn('Change passcode', changePasscode, { small: true }),
              UI.btn('Turn off lock', turnOffLock, { small: true, kind: 'ghost' })
            )
          );
        } else {
          priv.appendChild(h('p.status-line', UI.icon('unlock'), 'App lock is off.'));
          priv.appendChild(UI.btn('Turn on app lock', () => setupLock(), { small: true, icon: 'lock' }));
        }
      }
      root.appendChild(priv);

      /* Reminders */
      const gcal = h(
        'a.btn.small' + (L.env.artifact ? '' : '.ghost'),
        { href: googleLink(drafts.remTime || '20:00'), target: '_blank', rel: 'noopener noreferrer' },
        UI.icon('link'),
        h('span', 'Add to Google Calendar')
      );
      const time = h('input.input.time-input#rem-time', {
        type: 'time',
        value: drafts.remTime || '20:00',
        onchange: (e) => {
          drafts.remTime = e.target.value || '20:00';
          gcal.href = googleLink(drafts.remTime);
        }
      });
      const rem = h(
        'section.card.set-sec',
        h('h2.card-title', 'Daily reminder'),
        h('p', 'A gentle nudge to check in. Lantern can’t send notifications itself, so the reminder lives in your calendar or on your phone.'),
        UI.field('Remind me at', time)
      );
      const remActs = h('div.actions');
      if (!L.env.artifact) {
        remActs.appendChild(
          UI.btn('Add to my calendar', async () => {
            try {
              await UI.download('lantern-reminder.ics', icsFor(time.value || '20:00'), 'text/calendar');
              UI.toast('Open the downloaded file to add the reminder.');
            } catch (e) {
              UI.toast(e.message);
            }
          }, { small: true, icon: 'calendar' })
        );
      }
      remActs.appendChild(gcal);
      rem.appendChild(remActs);
      rem.appendChild(h('p.help', 'On an iPhone you can also ask Siri: “Remind me every day at 8pm to check in with Lantern.”'));
      root.appendChild(rem);

      /* Data */
      const counts = D.counts();
      const data = h(
        'section.card.set-sec',
        h('h2.card-title', 'Your data'),
        h(
          'p',
          U.plural(counts.checkins, 'check-in') + ', ' + U.plural(counts.journal, 'journal entry', 'journal entries') + ', ' + U.plural(counts.goals, 'goal') + ', ' + U.plural(counts.wins, 'win') + '.'
        ),
        prefs.lastBackup ? h('p.muted.small', 'Last backup: ' + U.fmtLongYear(prefs.lastBackup) + '.') : null
      );
      if (D.backend && D.backend.name === 'cloud' && counts.docs > 4000) {
        data.appendChild(h('p.warn', 'Lantern is nearing its storage limit in claude.ai. Download a backup, then consider erasing older entries.'));
      }
      const acts = h('div.actions');
      acts.appendChild(UI.btn('Download a backup', downloadBackup, { small: true, icon: 'download' }));
      if (!L.app.demo) acts.appendChild(UI.btn('Restore from a backup', restoreBackup, { small: true, icon: 'upload' }));
      acts.appendChild(
        UI.btn('Export my journal', async () => {
          try {
            const r = await UI.download('lantern-journal-' + U.todayKey() + '.md', journalMarkdown(), 'text/markdown');
            if (r === 'saved') UI.toast('Journal exported.');
          } catch (e) {
            UI.toast(e.message);
          }
        }, { small: true, icon: 'journal', kind: 'ghost' })
      );
      data.appendChild(acts);
      data.appendChild(h('p.help', 'The journal export is a plain text file you can read, print or share with a therapist.'));
      if (L.app.demo) data.appendChild(UI.btn('Leave the example data', () => L.app.exitDemo(), { small: true, kind: 'primary' }));
      else data.appendChild(h('p', UI.btn('Look around with example data', () => L.app.enterDemo(), { small: true, kind: 'ghost' })));
      root.appendChild(data);

      if (!L.app.demo) {
        root.appendChild(
          h(
            'section.card.set-sec.danger-zone',
            h('h2.card-title', 'Erase everything'),
            h('p', 'Permanently delete everything in Lantern and start fresh.'),
            UI.btn('Erase everything', eraseEverything, { small: true, kind: 'danger' })
          )
        );
      }

      root.appendChild(
        h(
          'section.about',
          h('h2.section-title', 'About Lantern'),
          h('p', 'Lantern is a self-help tool. It isn’t a medical device and can’t diagnose or treat anything. If you’re struggling, please talk to your GP or one of the services in Support.'),
          h('p.fineprint', K.PHQ9.credit),
          h('p.fineprint', 'Version ' + K.VERSION)
        )
      );
    }
  };
})((window.Lantern = window.Lantern || {}));
