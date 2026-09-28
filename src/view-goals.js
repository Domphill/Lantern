/* Lantern — Goals: step-by-step goals and gentle weekly habits (no streaks to break). */
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

  function weekDays(date) {
    const mon = U.mondayOf(date || new Date());
    return [0, 1, 2, 3, 4, 5, 6].map((i) => U.dayKey(U.addDays(mon, i)));
  }
  function weekCount(g, date) {
    const days = new Set(weekDays(date));
    return (g.log || []).filter((k) => days.has(k)).length;
  }

  async function toggleStep(goalId, stepId) {
    const g = U.clone(D.get('goals', goalId));
    if (!g) return;
    const st = (g.steps || []).find((x) => x.id === stepId);
    if (!st) return;
    st.done = !st.done;
    st.doneAt = st.done ? U.nowIso() : null;
    await D.put('goals', g);
    if (st.done && g.steps.every((x) => x.done) && g.status === 'active') {
      UI.toast('Every step is done.', { ms: 6000, action: { label: 'Finish goal', run: () => finishGoal(g.id) } });
    } else if (st.done) UI.toast('Step done. Nicely done.');
  }
  async function toggleHabitDay(goalId, dayKey) {
    const g = U.clone(D.get('goals', goalId));
    if (!g) return;
    const log = new Set(g.log || []);
    const adding = !log.has(dayKey);
    if (adding) log.add(dayKey);
    else log.delete(dayKey);
    g.log = [...log].sort();
    await D.put('goals', g);
    if (adding && dayKey === U.todayKey()) {
      const n = weekCount(g);
      UI.toast(n >= g.perWeek ? 'That’s ' + n + ' this week. You reached what you aimed for.' : 'Done for today. ' + n + ' of ' + g.perWeek + ' this week.');
    }
  }
  async function finishGoal(goalId) {
    const g = U.clone(D.get('goals', goalId));
    if (!g) return;
    g.status = 'done';
    g.doneAt = U.nowIso();
    await D.put('goals', g);
    celebrate(g.title);
  }

  function celebrate(title) {
    const layer = document.getElementById('layer') || document.body;
    const sparks = h('div.sparks', { 'aria-hidden': 'true' });
    for (let i = 0; i < 14; i++) sparks.appendChild(h('span.spark', { style: { '--a': i * (360 / 14) + 'deg', '--d': 60 + (i % 3) * 26 + 'px', '--t': 0.9 + (i % 4) * 0.12 + 's' } }));
    const close = () => el.remove();
    const el = h(
      'div.celebrate',
      { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'cel-title' },
      h('div.celebrate-backdrop', { onclick: close }),
      h(
        'div.celebrate-card',
        h('div.celebrate-mark', sparks, UI.logo(64)),
        h('h2#cel-title', 'You did it.'),
        h('p.celebrate-goal', title),
        h('p.muted', 'That took effort, and it counts. Take a moment to notice it.'),
        UI.btn('Thank you', close, { kind: 'primary', id: 'cel-ok' })
      )
    );
    layer.appendChild(el);
    requestAnimationFrame(() => {
      const b = document.getElementById('cel-ok');
      if (b) b.focus();
    });
  }

  /* ---------- goal form (new and edit) ---------- */
  function goalForm(existing) {
    const st = existing
      ? { kind: existing.kind, title: existing.title, why: existing.why || '', area: existing.area || null, perWeek: existing.perWeek || 3, target: existing.target || '', steps: [] }
      : { kind: 'steps', title: '', why: '', area: null, perWeek: 3, target: '', steps: ['', '', ''] };
    const body = h('div.form');
    const err = h('p.form-error', { role: 'alert' });

    function paint() {
      UI.clear(body);
      const title = h('input.input#goal-title', {
        type: 'text',
        maxlength: 120,
        value: st.title,
        placeholder: st.kind === 'habit' ? 'For example: a short walk' : 'For example: sort out the spare room',
        'data-autofocus': existing ? null : '',
        oninput: (e) => {
          st.title = e.target.value;
        }
      });
      body.appendChild(UI.field('What would you like to work towards?', title));
      if (!existing) {
        body.appendChild(
          h(
            'div.field',
            h('span.label', 'What kind of goal?'),
            UI.segmented({
              label: 'Kind of goal',
              value: st.kind,
              options: [
                { value: 'steps', label: 'Break it into steps' },
                { value: 'habit', label: 'Something to repeat' }
              ],
              onChange: (v) => {
                st.kind = v;
                paint();
              }
            })
          )
        );
      }
      if (st.kind === 'habit') {
        body.appendChild(
          h(
            'div.field',
            h('span.label', 'How many times a week?'),
            h('span.help', 'Aim lower than you think. You can always do more.'),
            UI.segmented({
              label: 'Times a week',
              value: st.perWeek,
              options: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) })),
              onChange: (v) => {
                st.perWeek = v;
              }
            })
          )
        );
      } else if (!existing) {
        const list = h('div.step-inputs');
        const labels = ['First step', 'Next step', 'Another step'];
        st.steps.forEach((val, i) => {
          list.appendChild(
            h('input.input', {
              type: 'text',
              maxlength: 160,
              value: val,
              'aria-label': labels[i] || 'Another step',
              placeholder: i === 0 ? 'The smallest possible start' : labels[i] || 'Another step',
              oninput: (e) => {
                st.steps[i] = e.target.value;
              }
            })
          );
        });
        body.appendChild(
          h(
            'div.field',
            h('span.label', 'Small steps'),
            h('span.help', 'Make the first one so small it feels almost too easy.'),
            list,
            h(
              'button.link-btn',
              {
                type: 'button',
                onclick: () => {
                  st.steps.push('');
                  paint();
                }
              },
              '+ Add another step'
            )
          )
        );
      }
      body.appendChild(
        UI.field(
          'Why does this matter to you?',
          UI.autoGrow(
            h('textarea.input', {
              rows: 2,
              maxlength: 600,
              value: st.why,
              placeholder: 'Optional',
              oninput: (e) => {
                st.why = e.target.value;
              }
            })
          ),
          'Linking a goal to what you care about makes it easier to keep going.'
        )
      );
      body.appendChild(
        h(
          'div.field',
          h('span.label', 'Part of life (optional)'),
          UI.chips({
            label: 'Part of life',
            options: K.AREAS,
            selected: new Set(st.area ? [st.area] : []),
            onToggle: (t, on) => {
              st.area = on ? t : null;
              paint();
            }
          })
        )
      );
      if (st.kind !== 'habit') {
        body.appendChild(
          UI.field(
            'Aim to finish by (optional)',
            h('input.input.date-input', {
              type: 'date',
              value: st.target,
              onchange: (e) => {
                st.target = e.target.value;
              }
            })
          )
        );
      }
      body.appendChild(err);
    }
    paint();
    return { body, st, err };
  }

  function newGoal(kind) {
    const f = goalForm(null);
    if (kind) {
      f.st.kind = kind;
    }
    const s = UI.sheet({
      title: 'New goal',
      body: f.body,
      actions: [
        UI.btn('Cancel', () => s.close(), { kind: 'ghost' }),
        UI.btn('Create goal', async () => {
          const st = f.st;
          if (U.isBlank(st.title)) {
            f.err.textContent = 'Give your goal a name first.';
            const t = document.getElementById('goal-title');
            if (t) t.focus();
            return;
          }
          const rec = {
            kind: st.kind,
            title: st.title.trim(),
            why: st.why.trim(),
            area: st.area,
            status: 'active',
            target: st.kind === 'habit' ? null : st.target || null,
            perWeek: st.kind === 'habit' ? st.perWeek : null,
            log: [],
            steps:
              st.kind === 'habit'
                ? []
                : st.steps
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((t) => ({ id: U.uid(), text: t, done: false, doneAt: null }))
          };
          const saved = await D.put('goals', rec);
          s.close();
          UI.toast('Goal added.', { action: { label: 'Open', run: () => R.go('goal', saved.id) } });
        }, { kind: 'primary' })
      ]
    });
  }

  function editGoal(g) {
    const f = goalForm(g);
    const s = UI.sheet({
      title: 'Edit goal',
      body: f.body,
      actions: [
        UI.btn('Cancel', () => s.close(), { kind: 'ghost' }),
        UI.btn('Save', async () => {
          const st = f.st;
          if (U.isBlank(st.title)) {
            f.err.textContent = 'Give your goal a name first.';
            return;
          }
          const rec = U.clone(D.get('goals', g.id));
          Object.assign(rec, { title: st.title.trim(), why: st.why.trim(), area: st.area, target: rec.kind === 'habit' ? null : st.target || null, perWeek: rec.kind === 'habit' ? st.perWeek : rec.perWeek });
          await D.put('goals', rec);
          s.close();
        }, { kind: 'primary' })
      ]
    });
  }

  /* ---------- list ---------- */
  function weekDots(g) {
    const today = U.todayKey();
    const log = new Set(g.log || []);
    return h(
      'div.week-dots',
      { 'aria-label': 'This week: ' + weekCount(g) + ' of ' + g.perWeek },
      weekDays().map((k) =>
        h('span.wd' + (log.has(k) ? '.on' : '') + (k === today ? '.today' : '') + (k > today ? '.future' : ''), { title: U.fmtShort(U.parseDay(k)), 'aria-hidden': 'true' }, U.fmtWeekday(U.parseDay(k)).charAt(0))
      )
    );
  }

  function goalCard(g) {
    const today = U.todayKey();
    const card = h('article.goal-card');
    card.appendChild(
      h(
        'button.goal-open',
        { type: 'button', onclick: () => R.go('goal', g.id) },
        h('span.goal-kind', UI.icon(g.kind === 'habit' ? 'repeat' : 'steps'), g.kind === 'habit' ? 'Habit' : 'Steps', g.area ? ' · ' + g.area : ''),
        h('h3.goal-title', g.title),
        UI.icon('chev', 'goal-chev')
      )
    );
    if (g.kind === 'habit') {
      const done = (g.log || []).includes(today);
      card.appendChild(
        h(
          'div.goal-progress',
          weekDots(g),
          h('span.goal-count', weekCount(g) + ' of ' + g.perWeek + ' this week')
        )
      );
      if (g.status === 'active') {
        card.appendChild(
          h(
            'div.goal-quick',
            h(
              'button.btn.small' + (done ? '.done-btn' : ''),
              { type: 'button', 'aria-pressed': String(done), onclick: () => toggleHabitDay(g.id, today) },
              UI.icon('check'),
              h('span', done ? 'Done today' : 'Mark today as done')
            )
          )
        );
      }
    } else {
      const steps = g.steps || [];
      const n = steps.filter((x) => x.done).length;
      const pct = steps.length ? Math.round((n / steps.length) * 100) : 0;
      card.appendChild(
        h(
          'div.goal-progress',
          h('div.meter', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(steps.length), 'aria-valuenow': String(n), 'aria-label': 'Steps done' }, h('span.meter-fill', { style: { width: pct + '%' } })),
          h('span.goal-count', steps.length ? n + ' of ' + steps.length + ' steps' : 'No steps yet')
        )
      );
      const next = steps.find((x) => !x.done);
      if (next && g.status === 'active') {
        card.appendChild(h('div.goal-next', V.checkBox(false, next.text, () => toggleStep(g.id, next.id)), h('span', h('span.muted', 'Next: '), next.text)));
      }
      if (g.target && g.status === 'active') card.appendChild(h('p.goal-target', UI.icon('calendar'), 'Aiming for ' + U.fmtDayMonth(U.parseDay(g.target))));
    }
    if (g.status === 'done' && g.doneAt) card.appendChild(h('p.goal-target', UI.icon('check'), 'Finished on ' + U.fmtDayMonthYear(g.doneAt)));
    return card;
  }

  V.goals = {
    live: true,
    newGoal,
    toggleStep,
    toggleHabitDay,
    weekCount,
    render(root) {
      root.appendChild(h('div.page-head', h('h1.page-title', 'Goals'), UI.btn('New goal', () => newGoal(), { kind: 'primary', icon: 'plus' })));
      const all = D.list('goals');
      const active = all.filter((g) => g.status === 'active').sort(U.byAsc((g) => g.created));
      const done = all.filter((g) => g.status === 'done').sort(U.byDesc((g) => g.doneAt || ''));
      const archived = all.filter((g) => g.status === 'archived').sort(U.byDesc((g) => g.updated || ''));
      const p = D.profile();
      if (!(p.dismissed || {}).goalTip) {
        root.appendChild(
          h(
            'section.notice',
            h('div', h('h2.notice-title', 'Small and specific works best.'), h('p', '“Walk to the shop on Saturday” is easier to start than “get fit”. When a step feels hard, make it smaller.')),
            UI.iconBtn('x', 'Dismiss tip', () => D.updateProfile({ dismissed: Object.assign({}, p.dismissed || {}, { goalTip: U.nowIso() }) }))
          )
        );
      }
      if (!active.length) {
        root.appendChild(
          UI.empty(
            done.length ? 'Nothing on the go right now' : 'No goals yet',
            'Goals here can be tiny. On a hard day, “get dressed” is a real goal.',
            h('div.actions.center', UI.btn('Break something into steps', () => newGoal('steps'), { icon: 'steps' }), UI.btn('Start a habit', () => newGoal('habit'), { icon: 'repeat' }))
          )
        );
      } else {
        root.appendChild(h('div.goal-grid', active.map(goalCard)));
      }
      if (done.length) {
        root.appendChild(h('details.fold', { open: drafts.showDone ? '' : null, ontoggle: (e) => (drafts.showDone = e.target.open) }, h('summary', 'Finished (' + done.length + ')'), h('div.goal-grid', done.map(goalCard))));
      }
      if (archived.length) {
        root.appendChild(h('details.fold', { open: drafts.showArchived ? '' : null, ontoggle: (e) => (drafts.showArchived = e.target.open) }, h('summary', 'Put aside (' + archived.length + ')'), h('div.goal-grid', archived.map(goalCard))));
      }
    }
  };

  /* ---------- one goal ---------- */
  V.goal = {
    live: true,
    render(root, id) {
      const g = D.get('goals', id);
      if (!g) {
        root.appendChild(UI.empty('Goal not found', 'It may have been deleted.', UI.btn('Back to goals', () => R.go('goals'))));
        return;
      }
      root.appendChild(
        h(
          'div.editor-bar',
          h('button.back-btn', { type: 'button', onclick: () => R.back('goals') }, UI.icon('back'), h('span', 'Goals')),
          h('span'),
          UI.btn('Edit', () => editGoal(g), { small: true, icon: 'edit' })
        )
      );
      const art = h('article.goal-page');
      art.appendChild(h('p.eyebrow', (g.kind === 'habit' ? 'Habit' : 'Goal') + (g.area ? ' · ' + g.area : '')));
      art.appendChild(h('h1.goal-heading', g.title));
      if (g.why) art.appendChild(h('blockquote.why', h('span.why-label', 'Why it matters'), g.why));
      if (g.target && g.kind !== 'habit') art.appendChild(h('p.goal-target', UI.icon('calendar'), 'Aiming for ' + U.fmtLong(U.parseDay(g.target))));

      if (g.kind === 'habit') {
        const today = U.todayKey();
        const log = new Set(g.log || []);
        art.appendChild(h('h2.section-title', 'This week'));
        art.appendChild(
          h(
            'div.week-toggle',
            { role: 'group', 'aria-label': 'Days this week' },
            weekDays().map((k) => {
              const d = U.parseDay(k);
              const on = log.has(k);
              return h(
                'button.day-toggle' + (on ? '.on' : '') + (k === today ? '.today' : ''),
                { type: 'button', 'aria-pressed': String(on), disabled: k > today, 'aria-label': U.fmtLong(d) + (on ? ', done' : ''), onclick: () => toggleHabitDay(g.id, k) },
                h('span.dt-wd', U.fmtWeekday(d)),
                h('span.dt-num', String(d.getDate())),
                on ? UI.icon('check', 'dt-check') : h('span.dt-check-space')
              );
            })
          )
        );
        art.appendChild(h('p.muted', weekCount(g) + ' of ' + g.perWeek + ' this week · ' + U.plural(log.size, 'time') + ' in total'));
        const weeks = [];
        for (let w = 7; w >= 0; w--) {
          const days = weekDays(U.addDays(new Date(), -7 * w));
          weeks.push({ start: days[0], n: days.filter((k) => log.has(k)).length });
        }
        art.appendChild(h('h2.section-title', 'Last eight weeks'));
        art.appendChild(
          h(
            'div.weeks-strip',
            { role: 'list' },
            weeks.map((w) =>
              h(
                'div.week-cell' + (w.n >= g.perWeek ? '.met' : w.n ? '.some' : ''),
                { role: 'listitem', 'aria-label': 'Week of ' + U.fmtDayMonth(U.parseDay(w.start)) + ': ' + w.n + ' of ' + g.perWeek },
                h('span.wc-n', String(w.n)),
                h('span.wc-d', U.fmtDayMonth(U.parseDay(w.start)))
              )
            )
          )
        );
      } else {
        const steps = g.steps || [];
        const n = steps.filter((x) => x.done).length;
        art.appendChild(h('div.goal-progress.big', h('div.meter', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(steps.length || 1), 'aria-valuenow': String(n), 'aria-label': 'Steps done' }, h('span.meter-fill', { style: { width: (steps.length ? (n / steps.length) * 100 : 0) + '%' } })), h('span.goal-count', steps.length ? n + ' of ' + steps.length + ' steps done' : 'No steps yet')));
        const ul = h('ul.step-list.editable');
        steps.forEach((stp) => {
          ul.appendChild(
            h(
              'li.step-item' + (stp.done ? '.done' : ''),
              V.checkBox(stp.done, stp.text, () => toggleStep(g.id, stp.id)),
              h('div.step-text', h('span.step-main', stp.text), stp.done && stp.doneAt ? h('span.step-meta', 'Done ' + U.relDay(stp.doneAt).toLowerCase()) : null),
              UI.iconBtn('x', 'Remove step: ' + stp.text, async () => {
                const r = U.clone(D.get('goals', g.id));
                r.steps = r.steps.filter((x) => x.id !== stp.id);
                await D.put('goals', r);
              }, { cls: 'step-x' })
            )
          );
        });
        art.appendChild(ul);
        const nd = drafts.newStep || (drafts.newStep = {});
        const input = h('input.input#step-new', {
          type: 'text',
          maxlength: 160,
          placeholder: 'Add a small step',
          'aria-label': 'Add a step',
          value: nd[g.id] || '',
          oninput: (e) => {
            nd[g.id] = e.target.value;
          },
          onkeydown: (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addStep();
            }
          }
        });
        async function addStep() {
          const t = (nd[g.id] || '').trim();
          if (!t) return;
          nd[g.id] = '';
          const r = U.clone(D.get('goals', g.id));
          r.steps = (r.steps || []).concat({ id: U.uid(), text: t, done: false, doneAt: null });
          await D.put('goals', r);
        }
        art.appendChild(h('div.inline-form', input, UI.btn('Add', addStep, { small: true })));
      }

      const acts = h('div.goal-actions');
      if (g.status === 'active') {
        acts.appendChild(UI.btn('Mark as finished', () => finishGoal(g.id), { kind: 'primary', icon: 'check' }));
        acts.appendChild(
          UI.btn('Put aside for now', async () => {
            const r = U.clone(g);
            r.status = 'archived';
            await D.put('goals', r);
            UI.toast('Put aside. You can pick it up again any time.');
          }, { kind: 'ghost', icon: 'archive' })
        );
      } else {
        if (g.status === 'done' && g.doneAt) acts.appendChild(h('p.muted', 'Finished on ' + U.fmtLongYear(g.doneAt) + '.'));
        acts.appendChild(
          UI.btn(g.status === 'done' ? 'Reopen' : 'Pick it up again', async () => {
            const r = U.clone(g);
            r.status = 'active';
            r.doneAt = null;
            await D.put('goals', r);
          }, { kind: 'ghost', icon: 'refresh' })
        );
      }
      acts.appendChild(
        UI.btn('Delete goal', async () => {
          const ok = await UI.confirm({ title: 'Delete this goal?', body: 'Its steps and history will be removed.', confirm: 'Delete', danger: true });
          if (!ok) return;
          const snap = U.clone(g);
          await D.remove('goals', g.id);
          R.go('goals', null, { replace: true });
          UI.toast('Goal deleted', { action: { label: 'Undo', run: () => D.put('goals', snap, { touch: false }) } });
        }, { kind: 'ghost.danger-text', icon: 'trash' })
      );
      art.appendChild(acts);
      root.appendChild(art);
    }
  };
})((window.Lantern = window.Lantern || {}));
