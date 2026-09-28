/* Lantern — Toolkit: breathing, grounding, small steps, self-compassion, PHQ-9. */
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

  function backBar(label, fallback) {
    return h('div.editor-bar', h('button.back-btn', { type: 'button', onclick: () => R.back(fallback || 'toolkit') }, UI.icon('back'), h('span', label || 'Toolkit')));
  }

  /* ---------- toolkit home ---------- */
  const TOOLS = [
    { go: ['breathe'], icon: 'wind', name: 'Breathe', desc: 'Slow your breathing with a gentle guide.', time: '1 to 5 minutes' },
    { go: ['ground'], icon: 'anchor', name: 'Ground yourself', desc: 'The 5-4-3-2-1 senses exercise, for when everything feels like too much.', time: 'About 3 minutes' },
    { go: ['ideas'], icon: 'spark', name: 'Small steps', desc: 'Tiny things that can lift a heavy day a little.', time: 'A few minutes' },
    { go: ['compassion'], icon: 'heart', name: 'Self-compassion break', desc: 'Three short steps to be a little kinder to yourself.', time: 'About 3 minutes' },
    { go: ['new', 'thought'], icon: 'feather', name: 'Thought record', desc: 'Untangle a painful thought, step by step.', time: 'About 10 minutes' },
    { go: ['phq'], icon: 'clipboard', name: 'Depression check', desc: 'The PHQ-9 questionnaire that GPs use, to track how you’re doing.', time: 'About 2 minutes' },
    { go: ['support'], icon: 'shield', name: 'My safety plan', desc: 'Your own plan, and people to contact when things are hard.', time: '', wide: true }
  ];

  V.toolkit = {
    live: true,
    render(root) {
      root.appendChild(h('div.page-head', h('div', h('h1.page-title', 'Toolkit'), h('p.lead', 'Things to try when you need them.'))));
      root.appendChild(
        h(
          'div.tool-grid',
          TOOLS.map((t) =>
            h(
              'button.tool-card' + (t.wide ? '.wide' : ''),
              { type: 'button', onclick: () => R.go(t.go[0], t.go[1]) },
              h('span.tool-ic', UI.icon(t.icon)),
              h('span.tool-name', t.name),
              h('span.tool-desc', t.desc),
              t.time ? h('span.tool-time', t.time) : null
            )
          )
        )
      );
    }
  };

  /* ---------- breathing ---------- */
  const PATTERNS = {
    calm: { name: 'Calm', desc: 'In for 4, out for 6', phases: [['in', 4], ['out', 6]] },
    box: { name: 'Box', desc: 'In 4, hold 4, out 4, hold 4', phases: [['in', 4], ['hold', 4], ['out', 4], ['rest', 4]] },
    b478: { name: '4-7-8', desc: 'In 4, hold 7, out 8', phases: [['in', 4], ['hold', 7], ['out', 8]] }
  };
  const WORDS = { in: 'Breathe in', hold: 'Hold', out: 'Breathe out', rest: 'Hold' };
  let session = null;
  function stopSession() {
    if (!session) return;
    session.stopped = true;
    clearTimeout(session.t);
    clearInterval(session.tick);
    if (session.lock) session.lock.release().catch(() => {});
    session = null;
  }

  V.breathe = {
    live: false,
    leave: stopSession,
    render(root) {
      const st = drafts.breathe || (drafts.breathe = { pattern: 'calm', minutes: 2 });
      root.appendChild(backBar());
      root.appendChild(h('h1.page-title', 'Breathe'));
      root.appendChild(h('p.lead', 'A longer breath out tells your body it’s safe to settle. Follow the light as it grows and shrinks.'));
      const controls = h(
        'div.breathe-controls',
        h(
          'div.field',
          h('span.label', 'Pattern'),
          UI.segmented({
            label: 'Breathing pattern',
            value: st.pattern,
            options: Object.keys(PATTERNS).map((k) => ({ value: k, label: PATTERNS[k].name })),
            onChange: (v) => {
              st.pattern = v;
              desc.textContent = PATTERNS[v].desc;
            }
          })
        ),
        h(
          'div.field',
          h('span.label', 'How long'),
          UI.segmented({
            label: 'Duration',
            value: st.minutes,
            options: [1, 2, 5].map((m) => ({ value: m, label: m + ' min' })),
            onChange: (v) => {
              st.minutes = v;
            }
          })
        )
      );
      const desc = h('p.muted.center', PATTERNS[st.pattern].desc);
      const orb = h('div.breath-orb', { 'data-phase': 'rest' }, h('div.breath-core'));
      const label = h('p.breath-label', { 'aria-live': 'polite' }, 'Ready when you are');
      const count = h('p.breath-count', { 'aria-hidden': 'true' }, '');
      const left = h('p.breath-left.muted', '');
      const startBtn = UI.btn('Start', start, { kind: 'primary', icon: 'play', id: 'breathe-start' });
      const stopBtn = UI.btn('Stop', () => {
        stopSession();
        reset('Stopped. Start again whenever you like.');
      }, { icon: 'stop', id: 'breathe-stop' });
      stopBtn.hidden = true;
      const after = h('div.actions.center');
      after.hidden = true;
      const stage = h('div.breath-stage', orb, h('div.breath-text', label, count));
      root.appendChild(h('div.breathe-main', stage, left, h('div.actions.center', startBtn, stopBtn), after));
      root.appendChild(h('div.breathe-settings', controls, desc));

      function reset(msg) {
        orb.style.transitionDuration = '1.2s';
        orb.dataset.phase = 'rest';
        label.textContent = msg;
        count.textContent = '';
        left.textContent = '';
        startBtn.hidden = false;
        stopBtn.hidden = true;
        controls.classList.remove('dim');
      }
      function finish() {
        stopSession();
        reset('Well done. Notice how you feel now.');
        UI.clear(after);
        after.appendChild(UI.btn('Check in', () => R.go('today'), { small: true }));
        after.appendChild(UI.btn('Back to toolkit', () => R.go('toolkit'), { small: true, kind: 'ghost' }));
        after.hidden = false;
      }
      function start() {
        stopSession();
        after.hidden = true;
        const p = PATTERNS[st.pattern];
        const total = st.minutes * 60 * 1000;
        const s = (session = { stopped: false, t: null, tick: null, i: 0, endAt: Date.now() + total, phaseEnd: 0, lock: null });
        try {
          if (navigator.wakeLock && navigator.wakeLock.request) {
            navigator.wakeLock
              .request('screen')
              .then((l) => {
                if (session === s) s.lock = l;
                else l.release();
              })
              .catch(() => {});
          }
        } catch (e) {
          /* optional */
        }
        startBtn.hidden = true;
        stopBtn.hidden = false;
        controls.classList.add('dim');
        const step = () => {
          if (s.stopped) return;
          if (Date.now() >= s.endAt && s.i % p.phases.length === 0) {
            finish();
            return;
          }
          const [kind, secs] = p.phases[s.i % p.phases.length];
          s.i++;
          orb.style.transitionDuration = secs + 's';
          orb.dataset.phase = kind;
          label.textContent = WORDS[kind];
          s.phaseEnd = Date.now() + secs * 1000;
          s.t = setTimeout(step, secs * 1000);
        };
        s.tick = setInterval(() => {
          if (s.stopped) return;
          count.textContent = String(Math.max(1, Math.ceil((s.phaseEnd - Date.now()) / 1000)));
          const rem = Math.max(0, Math.ceil((s.endAt - Date.now()) / 1000));
          left.textContent = rem > 0 ? Math.floor(rem / 60) + ':' + U.pad2(rem % 60) + ' left' : 'Finishing this breath';
        }, 200);
        step();
      }
    }
  };

  /* ---------- grounding ---------- */
  const GROUND = [
    { n: 5, sense: 'see', text: 'Look around you. Name five things you can see. Say them out loud or in your head.' },
    { n: 4, sense: 'feel', text: 'Notice four things you can feel. Your feet on the floor, the weight of your body, the air on your skin.' },
    { n: 3, sense: 'hear', text: 'Listen for three things you can hear, near or far.' },
    { n: 2, sense: 'smell', text: 'Find two things you can smell. If nothing comes, think of two smells you like.' },
    { n: 1, sense: 'taste', text: 'Notice one thing you can taste. A sip of water works well.' }
  ];
  function stepper(root, steps, st, renderStep, onEnd) {
    const box = h('div.stepper-card');
    root.appendChild(box);
    const paint = () => {
      UI.clear(box);
      if (st.i >= steps.length) {
        onEnd(box);
        return;
      }
      box.appendChild(renderStep(steps[st.i], st.i));
      box.appendChild(
        h(
          'div.step-dots',
          { 'aria-label': 'Step ' + (st.i + 1) + ' of ' + steps.length },
          steps.map((_, i) => h('span.sd' + (i === st.i ? '.on' : i < st.i ? '.done' : ''), { 'aria-hidden': 'true' }))
        )
      );
      box.appendChild(
        h(
          'div.actions.center',
          st.i > 0
            ? UI.btn('Back', () => {
                st.i--;
                paint();
              }, { kind: 'ghost' })
            : null,
          UI.btn(st.i === steps.length - 1 ? 'Finish' : 'Next', () => {
            st.i++;
            paint();
            const hd = box.querySelector('h2');
            if (hd) {
              hd.setAttribute('tabindex', '-1');
              hd.focus({ preventScroll: true });
            }
          }, { kind: 'primary', id: 'step-next' })
        )
      );
    };
    paint();
  }

  V.ground = {
    live: false,
    render(root) {
      const st = (drafts.ground = { i: 0 });
      root.appendChild(backBar());
      root.appendChild(h('h1.page-title', 'Ground yourself'));
      root.appendChild(h('p.lead', 'When your mind is racing or everything feels like too much, your senses can bring you back to right now. Take your time with each step.'));
      stepper(
        root,
        GROUND,
        st,
        (g) => h('div.ground-step', h('span.big-num', { 'aria-hidden': 'true' }, String(g.n)), h('h2.step-title', g.n + ' thing' + (g.n > 1 ? 's' : '') + ' you can ' + g.sense), h('p.step-body', g.text)),
        (box) => {
          box.appendChild(
            h(
              'div.ground-step',
              h('h2.step-title', 'You’re here, right now.'),
              h('p.step-body', 'Take one more slow breath. If it helps, check in and note how you feel.'),
              h(
                'div.actions.center',
                UI.btn('Start again', () => {
                  st.i = 0;
                  L.app.render();
                }, { kind: 'ghost' }),
                UI.btn('Check in', () => R.go('today'), { kind: 'primary' })
              )
            )
          );
        }
      );
    }
  };

  /* ---------- self-compassion break ---------- */
  const COMPASSION = [
    { t: 'This is a moment of difficulty.', b: 'Notice what you’re feeling, without judging it. You might say to yourself: “This is really hard right now.”' },
    { t: 'Struggling is part of being human.', b: 'You’re not the only one who feels like this. Other people are feeling something very similar right now. You’re not alone in it.' },
    { t: 'May I be kind to myself.', b: 'If it helps, put a hand on your chest. Think of what you’d say to a close friend who felt this way, and say it to yourself.' }
  ];
  V.compassion = {
    live: false,
    render(root) {
      const st = (drafts.compassion = { i: 0 });
      root.appendChild(backBar());
      root.appendChild(h('h1.page-title', 'Self-compassion break'));
      root.appendChild(h('p.lead', 'Three short steps. Read each one slowly and give it a moment.'));
      stepper(
        root,
        COMPASSION,
        st,
        (c, i) => h('div.ground-step', h('span.big-num', { 'aria-hidden': 'true' }, String(i + 1)), h('h2.step-title', c.t), h('p.step-body', c.b)),
        (box) => {
          box.appendChild(
            h(
              'div.ground-step',
              h('h2.step-title', 'Thank you for taking this time.'),
              h('p.step-body', 'Writing a few kind words to yourself can help them stick.'),
              h('div.actions.center', UI.btn('Write to myself', () => R.go('new', 'compassion'), { kind: 'primary', icon: 'feather' }), UI.btn('Back to toolkit', () => R.go('toolkit'), { kind: 'ghost' }))
            )
          );
        }
      );
    }
  };

  /* ---------- small steps ---------- */
  V.ideas = {
    live: true,
    render(root) {
      root.appendChild(backBar());
      root.appendChild(h('h1.page-title', 'Small steps'));
      root.appendChild(
        h('p.lead', 'When you’re low, waiting to feel like doing something rarely works. Doing a tiny thing first often helps the feeling follow. Pick one that feels possible.')
      );
      const groups = [];
      for (const s of K.SMALL_STEPS) {
        let g = groups.find((x) => x.k === s.k);
        if (!g) groups.push((g = { k: s.k, items: [] }));
        g.items.push(s.t);
      }
      const today = U.todayKey();
      const doneToday = new Set(
        D.list('wins')
          .filter((w) => w.source === 'idea' && U.dayKey(w.ts) === today)
          .map((w) => w.text)
      );
      for (const g of groups) {
        root.appendChild(h('h2.section-title', g.k));
        root.appendChild(
          h(
            'ul.idea-list',
            g.items.map((t) => {
              const done = doneToday.has(t);
              return h(
                'li.idea-row' + (done ? '.done' : ''),
                h('span', t),
                done
                  ? h('span.done-note', UI.icon('check'), 'Done today')
                  : UI.btn('I did it', async () => {
                      await D.put('wins', { ts: U.nowIso(), text: t, source: 'idea' });
                      UI.toast('Nice. That’s a win.');
                    }, { small: true, kind: 'ghost', icon: 'check' })
              );
            })
          )
        );
      }
    }
  };

  /* ---------- PHQ-9 ---------- */
  const BAND_TEXT = {
    Minimal: 'Your answers suggest few or no symptoms of depression right now. Keep doing what helps.',
    Mild: 'Your answers suggest mild symptoms. Keep an eye on how things go, and keep leaning on what helps.',
    Moderate: 'Your answers suggest moderate symptoms. If you haven’t already, it’s worth talking to your GP or NHS Talking Therapies. Support can make a real difference.',
    'Moderately severe': 'Your answers suggest things are really hard right now. Please talk to your GP soon. You deserve support, and treatment helps.',
    Severe: 'Your answers suggest things are really hard right now. Please talk to your GP soon. You deserve support, and treatment helps. If you feel unable to keep yourself safe, call 999, or call NHS 111 and choose option 2.'
  };

  function riskBox() {
    return h(
      'section.urgent',
      { role: 'region', 'aria-label': 'Support' },
      h('h2.urgent-title', 'Thank you for answering honestly.'),
      h('p', 'You said you’ve had thoughts that you’d be better off dead, or of hurting yourself. That matters, and you don’t have to deal with it alone.'),
      h('p', h('strong', 'If you might act on these thoughts, or you’ve hurt yourself, call 999 or go to A&E now.')),
      h('p', 'Samaritans are there day or night on ', h('strong.nowrap', '116 123'), '. NHS 111, option 2 connects you to urgent mental health support. Please let your GP know too.'),
      h(
        'div.actions',
        h('a.btn.primary.small', { href: 'tel:116123' }, UI.icon('phone'), h('span', 'Call Samaritans')),
        UI.btn('All support options', () => R.go('support'), { small: true })
      )
    );
  }

  V.phq = {
    live: false,
    leave() {
      if (drafts.phq && drafts.phq.result) drafts.phq = null;
    },
    render(root) {
      const st = drafts.phq || (drafts.phq = { answers: new Array(9).fill(null), difficulty: null, result: null });
      root.appendChild(backBar());
      if (st.result) {
        renderResult(root, st.result);
        return;
      }
      root.appendChild(h('h1.page-title', 'Depression check'));
      root.appendChild(h('p.lead', 'The PHQ-9 is a short questionnaire used by GPs and NHS Talking Therapies. It takes about two minutes. There are no right answers.'));
      root.appendChild(h('p.phq-stem', K.PHQ9.stem));
      const progress = h('p.phq-progress', { 'aria-live': 'polite' });
      const submit = UI.btn('See my score', submitPhq, { kind: 'primary', id: 'phq-submit' });
      const diffBox = h('div.phq-diff');
      const list = h('ol.phq-list');
      K.PHQ9.items.forEach((q, i) => {
        list.appendChild(h('li.phq-item', h('p.phq-q#phq-q' + i, q), optionGroup(K.PHQ9.options, st.answers[i], 'phq-q' + i, (v) => {
          st.answers[i] = v;
          sync();
        })));
      });
      root.appendChild(list);
      root.appendChild(diffBox);
      root.appendChild(h('div.phq-foot', progress, submit));
      root.appendChild(h('p.fineprint', K.PHQ9.credit));

      function sync() {
        const n = st.answers.filter((a) => a != null).length;
        progress.textContent = n + ' of 9 answered';
        submit.disabled = n < 9;
        const any = st.answers.some((a) => a > 0);
        if (any && !diffBox.firstChild) {
          diffBox.appendChild(h('p.phq-q#phq-diff', K.PHQ9.difficulty.q));
          diffBox.appendChild(optionGroup(K.PHQ9.difficulty.options, st.difficulty, 'phq-diff', (v) => (st.difficulty = v)));
          diffBox.appendChild(h('p.help', 'Optional.'));
        } else if (!any) UI.clear(diffBox);
      }
      sync();

      async function submitPhq() {
        if (st.answers.some((a) => a == null)) return;
        const score = st.answers.reduce((a, b) => a + b, 0);
        const rec = await D.put('tests', { ts: U.nowIso(), type: 'phq9', answers: st.answers.slice(), score, difficulty: st.difficulty });
        st.result = rec;
        L.app.render({ nav: true });
      }
    }
  };

  function optionGroup(options, value, labelledBy, onPick) {
    const g = h('div.phq-opts', { role: 'radiogroup', 'aria-labelledby': labelledBy });
    const btns = options.map((label, v) =>
      h(
        'button.phq-opt',
        {
          type: 'button',
          role: 'radio',
          'aria-checked': String(value === v),
          onclick: () => {
            btns.forEach((b, j) => b.setAttribute('aria-checked', String(j === v)));
            onPick(v);
          }
        },
        h('span.phq-radio', { 'aria-hidden': 'true' }),
        h('span', label)
      )
    );
    btns.forEach((b) => g.appendChild(b));
    return g;
  }

  function renderResult(root, rec) {
    const band = K.phqBand(rec.score);
    root.appendChild(h('p.eyebrow', 'Depression check · ' + U.fmtLong(rec.ts)));
    root.appendChild(h('h1.page-title', 'Your score is ' + rec.score));
    if (rec.answers[8] > 0) root.appendChild(riskBox());
    const scale = h(
      'div.phq-scale',
      { role: 'img', 'aria-label': 'Score ' + rec.score + ' out of 27, in the ' + band.label.toLowerCase() + ' range' },
      K.PHQ9.bands.map((b) => h('span.phq-band' + (b === band ? '.on' : ''), { style: { flex: String(b.max - b.min + 1) } }, h('span.phq-band-label', b.label), h('span.phq-band-range', b.min + '–' + b.max)))
    );
    root.appendChild(h('section.card', h('p.phq-band-now', band.label), scale, h('p', BAND_TEXT[band.label])));
    const tests = D.list('tests')
      .filter((t) => t.type === 'phq9' && t.id !== rec.id)
      .sort(U.byDesc((t) => t.ts));
    if (tests.length) {
      const prev = tests[0];
      const d = rec.score - prev.score;
      root.appendChild(h('p.muted', d === 0 ? 'The same as last time (' + U.fmtDayMonth(prev.ts) + ').' : (d < 0 ? 'Down ' + -d : 'Up ' + d) + (Math.abs(d) === 1 ? ' point' : ' points') + ' since ' + U.fmtDayMonth(prev.ts) + '.'));
    }
    root.appendChild(h('p.muted', 'This is a screening questionnaire, not a diagnosis. Many people share their scores with their GP or therapist. Taking it every two weeks shows how things are changing.'));
    root.appendChild(
      h(
        'div.actions',
        UI.btn('See my history', () => {
          drafts.phq = null;
          R.go('insights');
        }, { icon: 'insights' }),
        UI.btn('Done', () => {
          drafts.phq = null;
          R.go('today');
        }, { kind: 'primary' })
      )
    );
  }
})((window.Lantern = window.Lantern || {}));
