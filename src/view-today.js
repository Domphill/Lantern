/* Lantern — Today: check in, small steps, wins, one small idea, a prompt. */
(function (L) {
  'use strict';
  const U = L.util;
  const K = L.content;
  const UI = L.ui;
  const h = UI.h;
  const D = L.data;
  const R = L.router;
  const V = (L.views = L.views || {});
  const drafts = (L.drafts = L.drafts || {});

  const byTs = U.byAsc((r) => r.ts);
  const todays = (coll) => {
    const t = U.todayKey();
    return D.list(coll)
      .filter((r) => U.dayKey(r.ts) === t)
      .sort(byTs);
  };
  function lastOf(coll) {
    let best = null;
    for (const r of D.state[coll].values()) if (!best || r.ts > best.ts) best = r;
    return best;
  }

  function draft() {
    if (!drafts.checkin) drafts.checkin = { mood: null, emotions: [], activities: [], sleep: null, energy: null, note: '', editingId: null };
    return drafts.checkin;
  }
  function resetDraft() {
    drafts.checkin = null;
  }
  const rerender = () => L.app.render();

  /* ---------- mood picker (also used by the journal editor) ---------- */
  function moodPicker(current, onPick, opts) {
    opts = opts || {};
    return h(
      'div.mood-picker' + (opts.small ? '.small' : ''),
      { role: 'radiogroup', 'aria-label': opts.label || 'Mood' },
      K.MOODS.map((m) =>
        h(
          'button.mood-btn.l' + m.v,
          {
            type: 'button',
            role: 'radio',
            'aria-checked': String(current === m.v),
            id: opts.idPrefix ? opts.idPrefix + m.v : null,
            onclick: () => onPick(m.v)
          },
          h('span.mood-light', { 'aria-hidden': 'true' }),
          h('span.mood-label', m.label)
        )
      )
    );
  }
  V.moodPicker = moodPicker;

  function orderedEmotions(mood) {
    const g = (name) => K.EMOTIONS.filter((e) => e.g === name).map((e) => e.t);
    if (mood <= 2) return [...g('heavy'), ...g('steady'), ...g('light')];
    if (mood >= 4) return [...g('light'), ...g('steady'), ...g('heavy')];
    return [...g('steady'), ...g('heavy'), ...g('light')];
  }
  function toggleIn(list, item, on) {
    const i = list.indexOf(item);
    if (on && i < 0) list.push(item);
    if (!on && i >= 0) list.splice(i, 1);
  }
  async function addCustom(field, text, list) {
    const p = D.profile();
    const arr = (p[field] || []).slice();
    const builtIn = K.EMOTIONS.some((e) => e.t.toLowerCase() === text.toLowerCase()) || K.ACTIVITIES.some((a) => a.toLowerCase() === text.toLowerCase());
    if (!builtIn && !arr.some((x) => x.toLowerCase() === text.toLowerCase())) arr.push(text);
    if (!list.includes(text)) list.push(text);
    await D.updateProfile({ [field]: arr });
    rerender();
  }
  const fmtHours = (v) => (Number.isInteger(v) ? v : v.toFixed(1)) + ' h';

  function sleepControl(d) {
    const out = h('output.stepper-val#ci-sleep', { 'aria-live': 'polite' }, d.sleep == null ? 'Not set' : fmtHours(d.sleep));
    const set = (v) => {
      d.sleep = v == null ? null : U.clamp(Math.round(v * 2) / 2, 0, 16);
      out.textContent = d.sleep == null ? 'Not set' : fmtHours(d.sleep);
    };
    return h(
      'div.mini-field',
      h('span.label', 'Sleep last night'),
      h(
        'div.stepper',
        UI.iconBtn('minus', 'Less sleep', () => set(d.sleep == null ? 6 : d.sleep - 0.5)),
        out,
        UI.iconBtn('plus', 'More sleep', () => set(d.sleep == null ? 7 : d.sleep + 0.5))
      )
    );
  }
  function energyControl(d) {
    return h(
      'div.mini-field',
      h('span.label', 'Energy'),
      UI.segmented({
        label: 'Energy, from 1 (drained) to 5 (lots)',
        value: d.energy,
        options: [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) })),
        onChange: (v) => {
          d.energy = v;
        }
      }),
      h('span.seg-ends', h('span', 'Drained'), h('span', 'Lots'))
    );
  }

  /* ---------- check-in ---------- */
  function checkinCard() {
    const d = draft();
    const profile = D.profile();
    const card = h('section.card.checkin', { 'aria-labelledby': 'ci-title' });
    if (drafts.ack && !d.mood) {
      card.appendChild(ackPanel(drafts.ack));
      return card;
    }
    card.appendChild(h('h2.card-title#ci-title', d.editingId ? 'Edit this check-in' : 'How are you feeling right now?'));
    card.appendChild(
      moodPicker(
        d.mood,
        (v) => {
          d.mood = v;
          drafts.ack = null;
          rerender();
        },
        { idPrefix: 'ci-mood-' }
      )
    );
    if (!d.mood) {
      card.appendChild(h('p.hint', 'Tap one. That’s all it takes. You can add more if you want to.'));
      return card;
    }
    const more = h('div.checkin-more');
    more.appendChild(
      h(
        'div.group',
        h('h3.group-title', 'What best describes it?'),
        UI.chips({
          label: 'Feelings',
          options: orderedEmotions(d.mood).concat(profile.customEmotions || []),
          selected: new Set(d.emotions),
          onToggle: (t, on) => toggleIn(d.emotions, t, on),
          custom: { label: 'Add a feeling', onAdd: (t) => addCustom('customEmotions', t, d.emotions) }
        })
      )
    );
    more.appendChild(
      h(
        'div.group',
        h('h3.group-title', 'What has today included?'),
        UI.chips({
          label: 'Activities',
          options: K.ACTIVITIES.concat(profile.customActivities || []),
          selected: new Set(d.activities),
          onToggle: (t, on) => toggleIn(d.activities, t, on),
          custom: { label: 'Add an activity', onAdd: (t) => addCustom('customActivities', t, d.activities) }
        })
      )
    );
    const sleepLogged = todays('checkins').some((c) => c.sleep != null && c.id !== d.editingId);
    more.appendChild(h('div.checkin-row', sleepLogged ? null : sleepControl(d), energyControl(d)));
    const note = UI.autoGrow(
      h('textarea.input#ci-note', {
        rows: 2,
        maxlength: 4000,
        placeholder: 'Anything on your mind?',
        value: d.note,
        oninput: (e) => {
          d.note = e.target.value;
        }
      })
    );
    more.appendChild(UI.field('A note, if you like', note));
    more.appendChild(
      h(
        'div.actions',
        UI.btn(d.editingId ? 'Save changes' : 'Save check-in', saveCheckin, { kind: 'primary', id: 'ci-save' }),
        UI.btn('Cancel', () => {
          resetDraft();
          rerender();
        }, { kind: 'ghost' }),
        d.editingId ? UI.btn('Delete', deleteCheckin, { kind: 'ghost.danger-text' }) : null
      )
    );
    card.appendChild(more);
    return card;
  }

  async function saveCheckin() {
    const d = draft();
    if (!d.mood) return;
    const existing = d.editingId ? D.get('checkins', d.editingId) : null;
    const rec = Object.assign({}, existing || {}, {
      ts: existing ? existing.ts : U.nowIso(),
      mood: d.mood,
      emotions: d.emotions.slice(),
      activities: d.activities.slice(),
      sleep: d.sleep,
      energy: d.energy,
      note: d.note.trim()
    });
    const saved = await D.put('checkins', rec);
    drafts.ack = { mood: saved.mood, id: saved.id, edited: !!existing };
    resetDraft();
    rerender();
  }

  async function deleteCheckin() {
    const d = draft();
    const rec = d.editingId ? D.get('checkins', d.editingId) : null;
    if (!rec) return;
    const ok = await UI.confirm({ title: 'Delete this check-in?', body: 'It will be removed from your history.', confirm: 'Delete', danger: true });
    if (!ok) return;
    await D.remove('checkins', rec.id);
    resetDraft();
    rerender();
    UI.toast('Check-in deleted', { action: { label: 'Undo', run: () => D.put('checkins', rec, { touch: false }) } });
  }

  function editCheckin(c) {
    drafts.ack = null;
    drafts.checkin = {
      mood: c.mood,
      emotions: (c.emotions || []).slice(),
      activities: (c.activities || []).slice(),
      sleep: c.sleep == null ? null : c.sleep,
      energy: c.energy || null,
      note: c.note || '',
      editingId: c.id
    };
    rerender();
    const el = document.getElementById('ci-title');
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function ackPanel(ack) {
    const a = K.ACKS[ack.mood] || K.ACKS[3];
    const acts = [];
    if (ack.mood === 1) {
      acts.push(UI.btn('Breathe with me', () => R.go('breathe'), { icon: 'wind', small: true }));
      acts.push(UI.btn('Open my safety plan', () => R.go('support'), { icon: 'shield', small: true }));
      acts.push(UI.btn('Talk to someone', () => R.go('support'), { icon: 'phone', small: true }));
    } else if (ack.mood === 2) {
      acts.push(UI.btn('Find a small step', () => R.go('ideas'), { icon: 'spark', small: true }));
      acts.push(UI.btn('Write it down', () => R.go('new', 'free'), { icon: 'feather', small: true }));
    } else if (ack.mood === 3) {
      acts.push(UI.btn('Write a little', () => R.go('new', 'free'), { icon: 'feather', small: true }));
    } else {
      acts.push(
        UI.btn('Note what’s helping', () => {
          drafts.newPrompt = 'What’s helping today?';
          R.go('new', 'free');
        }, { icon: 'feather', small: true })
      );
      acts.push(
        UI.btn('Add a win', () => {
          const el = document.getElementById('win-input');
          if (el) {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            el.focus({ preventScroll: true });
          }
        }, { icon: 'spark', small: true })
      );
    }
    return h(
      'div.ack',
      { role: 'status' },
      h('div.ack-head', UI.moodDot(ack.mood, 'lg'), h('div', h('h2.card-title#ci-title', ack.edited ? 'Check-in updated.' : a.title), h('p.ack-body', a.body))),
      h('div.ack-actions', acts),
      h(
        'button.link-btn',
        {
          type: 'button',
          onclick: () => {
            drafts.ack = null;
            rerender();
          }
        },
        'Check in again'
      )
    );
  }

  function todayLog() {
    const list = todays('checkins');
    if (!list.length) return null;
    return h(
      'section.today-log',
      { 'aria-labelledby': 'log-title' },
      h('h2.mini-title#log-title', 'Today so far'),
      h(
        'ul.log-list',
        list.map((c) =>
          h(
            'li',
            h(
              'button.log-item',
              { type: 'button', onclick: () => editCheckin(c), 'aria-label': U.fmtTime(c.ts) + ', ' + K.moodLabel(c.mood) + '. Edit' },
              UI.moodDot(c.mood),
              h('span.log-time', U.fmtTime(c.ts)),
              h('span.log-mood', K.moodLabel(c.mood)),
              h('span.log-extra', (c.emotions || []).slice(0, 3).join(', ')),
              UI.icon('edit', 'log-edit')
            )
          )
        )
      )
    );
  }

  /* ---------- small steps from goals ---------- */
  function checkBox(on, label, onToggle) {
    return h(
      'button.check',
      {
        type: 'button',
        role: 'checkbox',
        'aria-checked': String(!!on),
        'aria-label': label,
        onclick: onToggle
      },
      UI.icon('check')
    );
  }
  V.checkBox = checkBox;

  function stepsCard() {
    const G = V.goals;
    const goals = D.list('goals')
      .filter((g) => g.status === 'active')
      .sort(U.byAsc((g) => g.created));
    const card = h(
      'section.card.steps-card',
      { 'aria-labelledby': 'steps-title' },
      h('div.card-head', h('h2.card-title#steps-title', 'Small steps'), goals.length ? h('button.link-btn', { type: 'button', onclick: () => R.go('goals') }, 'All goals') : null)
    );
    if (!goals.length) {
      card.appendChild(h('p.muted', 'Goals can be tiny. On a hard day, “open the curtains” is a real goal.'));
      card.appendChild(UI.btn('Set a small goal', () => G.newGoal(), { icon: 'plus', small: true }));
      return card;
    }
    const ul = h('ul.step-list');
    const today = U.todayKey();
    for (const g of goals.slice(0, 6)) {
      if (g.kind === 'habit') {
        const done = (g.log || []).includes(today);
        ul.appendChild(
          h(
            'li.step-item' + (done ? '.done' : ''),
            checkBox(done, g.title + ', done today', () => G.toggleHabitDay(g.id, today)),
            h('div.step-text', h('span.step-main', g.title), h('span.step-meta', G.weekCount(g) + ' of ' + g.perWeek + ' this week'))
          )
        );
      } else {
        const next = (g.steps || []).find((st) => !st.done);
        if (next) {
          ul.appendChild(
            h(
              'li.step-item',
              checkBox(false, next.text, () => G.toggleStep(g.id, next.id)),
              h('div.step-text', h('span.step-main', next.text), h('span.step-meta', g.title))
            )
          );
        } else {
          ul.appendChild(
            h(
              'li.step-item.done',
              h('span.check.static', { 'aria-hidden': 'true' }, UI.icon('check')),
              h(
                'div.step-text',
                h('span.step-main', g.title),
                h('button.link-btn.step-meta', { type: 'button', onclick: () => R.go('goal', g.id) }, (g.steps || []).length ? 'Every step done. Finish this goal?' : 'Add a first step')
              )
            )
          );
        }
      }
    }
    card.appendChild(ul);
    return card;
  }

  /* ---------- wins ---------- */
  function winsCard() {
    const today = U.todayKey();
    const wins = todays('wins');
    const derived = [];
    for (const g of D.list('goals')) {
      for (const st of g.steps || []) if (st.done && st.doneAt && U.dayKey(st.doneAt) === today) derived.push(st.text);
      if (g.kind === 'habit' && (g.log || []).includes(today)) derived.push(g.title);
      if (g.status === 'done' && g.doneAt && U.dayKey(g.doneAt) === today) derived.push('Finished: ' + g.title);
    }
    const input = h('input.input#win-input', {
      type: 'text',
      maxlength: 200,
      placeholder: 'Got up, replied to a message, went outside…',
      'aria-label': 'Add a win',
      onkeydown: (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          add();
        }
      }
    });
    async function add() {
      const t = input.value.trim();
      if (!t) {
        input.focus();
        return;
      }
      input.value = '';
      await D.put('wins', { ts: U.nowIso(), text: t, source: 'manual' });
      UI.toast('Saved. It counts.');
    }
    const list = h('ul.win-list');
    for (const w of wins) {
      list.appendChild(
        h(
          'li.win',
          UI.icon('spark', 'win-ic'),
          h('span.win-text', w.text),
          UI.iconBtn('x', 'Remove this win', async () => {
            await D.remove('wins', w.id);
            UI.toast('Win removed', { action: { label: 'Undo', run: () => D.put('wins', w, { touch: false }) } });
          }, { cls: 'win-x' })
        )
      );
    }
    for (const t of derived) list.appendChild(h('li.win.derived', UI.icon('check', 'win-ic'), h('span.win-text', t)));
    return h(
      'section.card.wins-card',
      { 'aria-labelledby': 'wins-title' },
      h('h2.card-title#wins-title', 'Today’s wins'),
      wins.length || derived.length ? list : h('p.muted', 'Anything you managed today counts, however small.'),
      h('div.inline-form', input, UI.btn('Add', add, { small: true }))
    );
  }

  /* ---------- one small thing ---------- */
  function ideaCard() {
    const n = K.SMALL_STEPS.length;
    const idea = K.SMALL_STEPS[(U.hashStr(U.todayKey() + '|idea') + (drafts.idea || 0)) % n];
    return h(
      'section.card.idea-card',
      { 'aria-labelledby': 'idea-title' },
      h('p.eyebrow#idea-title', 'One small thing'),
      h('p.idea-text', idea.t),
      h(
        'div.actions',
        UI.btn('I did it', async () => {
          await D.put('wins', { ts: U.nowIso(), text: idea.t, source: 'idea' });
          drafts.idea = (drafts.idea || 0) + 1;
          UI.toast('Nice. That’s a win.');
        }, { kind: 'primary', small: true, icon: 'check' }),
        UI.btn('Another idea', () => {
          drafts.idea = (drafts.idea || 0) + 1;
          rerender();
        }, { small: true, icon: 'refresh', kind: 'ghost' })
      )
    );
  }

  function promptCard() {
    const p = U.pickDaily(K.PROMPTS, 'prompt');
    return h(
      'section.card.prompt-card',
      { 'aria-labelledby': 'prompt-title' },
      h('p.eyebrow#prompt-title', 'Something to write about'),
      h('p.prompt-text', p),
      UI.btn('Write about this', () => {
        drafts.newPrompt = p;
        R.go('new', 'free');
      }, { icon: 'feather', small: true })
    );
  }

  /* ---------- gentle notices ---------- */
  function dismissedRecently(key, days) {
    const at = (D.profile().dismissed || {})[key];
    return at && U.dayDiff(U.dayKey(at), U.todayKey()) < days;
  }
  function dismiss(key) {
    const p = D.profile();
    D.updateProfile({ dismissed: Object.assign({}, p.dismissed || {}, { [key]: U.nowIso() }) });
  }
  function notices() {
    const out = [];
    const today = U.todayKey();
    const lastC = lastOf('checkins');
    const lastJ = lastOf('journal');
    const lastTs = [lastC && lastC.ts, lastJ && lastJ.ts].filter(Boolean).sort().pop();
    if (lastTs && U.dayDiff(U.dayKey(lastTs), today) >= 4 && !drafts.welcomeSeen) {
      out.push(
        h(
          'section.notice',
          h('div', h('h2.notice-title', 'Welcome back.'), h('p', 'Good to see you. There’s nothing to catch up on. Start from wherever you are today.')),
          UI.iconBtn('x', 'Dismiss', () => {
            drafts.welcomeSeen = true;
            rerender();
          })
        )
      );
    }
    const recent = D.list('checkins').filter((c) => U.dayDiff(U.dayKey(c.ts), today) <= 14);
    const daysSeen = new Set(recent.map((c) => U.dayKey(c.ts)));
    if (recent.length >= 5 && daysSeen.size >= 4 && U.avg(recent.map((c) => c.mood)) <= 2 && !dismissedRecently('lowNudge', 7)) {
      out.push(
        h(
          'section.notice.notice-warm',
          h(
            'div',
            h('h2.notice-title', 'Things have felt heavy lately.'),
            h('p', 'Your check-ins have been low for a while. You don’t have to carry this on your own. Your GP or NHS Talking Therapies can help, and in England you can refer yourself to Talking Therapies.'),
            h(
              'div.actions',
              UI.btn('See support options', () => R.go('support'), { small: true, kind: 'primary' }),
              h('button.link-btn', { type: 'button', onclick: () => dismiss('lowNudge') }, 'Not now')
            )
          )
        )
      );
    }
    const tests = D.list('tests').sort(U.byDesc((t) => t.ts));
    if (tests.length && U.dayDiff(U.dayKey(tests[0].ts), today) >= 14 && !dismissedRecently('phqNudge', 7)) {
      out.push(
        h(
          'section.notice',
          h(
            'div',
            h('h2.notice-title', 'Time for your fortnightly check?'),
            h('p', 'It’s been two weeks since your last PHQ-9. Taking it regularly shows how things are changing over time.'),
            h(
              'div.actions',
              UI.btn('Take it now', () => R.go('phq'), { small: true }),
              h('button.link-btn', { type: 'button', onclick: () => dismiss('phqNudge') }, 'Later')
            )
          )
        )
      );
    }
    return out;
  }

  function hero() {
    const last = lastOf('checkins');
    const name = (D.profile().name || '').trim();
    const glow = last && U.dayKey(last.ts) === U.todayKey() ? 'var(--m' + last.mood + ')' : null;
    return h(
      'header.hero',
      { style: glow ? { '--hero-glow': glow } : null },
      h('p.hero-date', U.fmtLong(new Date())),
      h('h1.hero-greet', U.greeting() + (name ? ', ' + name : '') + '.')
    );
  }

  V.today = {
    live: true,
    render(root) {
      root.appendChild(hero());
      for (const n of notices()) root.appendChild(n);
      root.appendChild(
        h('div.today-grid', h('div.col', checkinCard(), todayLog(), promptCard()), h('div.col', stepsCard(), winsCard(), ideaCard()))
      );
    }
  };
})((window.Lantern = window.Lantern || {}));
