/* Lantern — Insights: patterns over a chosen range. One range filter scopes everything below it. */
(function (L) {
  'use strict';
  const U = L.util;
  const K = L.content;
  const UI = L.ui;
  const h = UI.h;
  const D = L.data;
  const R = L.router;
  const CH = L.charts;
  const V = (L.views = L.views || {});
  const drafts = (L.drafts = L.drafts || {});

  const RANGES = [
    { value: 7, label: '7 days' },
    { value: 30, label: '30 days' },
    { value: 90, label: '90 days' },
    { value: 365, label: '1 year' }
  ];
  const MIN_DAYS = 3;

  function getRange() {
    if (!drafts.range) {
      let saved = 30;
      try {
        saved = Number(localStorage.getItem('lantern.range')) || 30;
      } catch (e) {
        /* optional */
      }
      drafts.range = RANGES.some((r) => r.value === saved) ? saved : 30;
    }
    return drafts.range;
  }
  function setRange(v) {
    drafts.range = v;
    try {
      localStorage.setItem('lantern.range', String(v));
    } catch (e) {
      /* optional */
    }
    L.app.render();
  }

  /* Per-day summaries for check-ins between two day keys (inclusive). */
  function dailyStats(startKey, endKey) {
    const days = new Map();
    for (const c of D.state.checkins.values()) {
      const k = U.dayKey(c.ts);
      if (k < startKey || k > endKey) continue;
      let d = days.get(k);
      if (!d) days.set(k, (d = { key: k, moods: [], acts: new Set(), emos: [], sleep: null }));
      d.moods.push(c.mood);
      for (const a of c.activities || []) d.acts.add(a);
      for (const e of c.emotions || []) d.emos.push(e);
      if (typeof c.sleep === 'number') d.sleep = Math.max(d.sleep == null ? 0 : d.sleep, c.sleep);
    }
    for (const d of days.values()) {
      d.avg = U.avg(d.moods);
      d.n = d.moods.length;
    }
    return days;
  }
  V.dailyStats = dailyStats;

  /* Average mood on days with each factor, against days without it. Needs a few days of each. */
  function factorEffects(days) {
    const list = [...days.values()];
    const out = [];
    const acts = new Set();
    list.forEach((d) => d.acts.forEach((a) => acts.add(a)));
    const push = (label, w, wo) => {
      if (w.length >= MIN_DAYS && wo.length >= MIN_DAYS) {
        const a = U.avg(w);
        const b = U.avg(wo);
        out.push({ label, diff: a - b, withAvg: a, withoutAvg: b, nW: w.length, nWo: wo.length });
      }
    };
    for (const a of acts) {
      const w = [];
      const wo = [];
      list.forEach((d) => (d.acts.has(a) ? w : wo).push(d.avg));
      push(a, w, wo);
    }
    const sw = [];
    const swo = [];
    list.forEach((d) => {
      if (d.sleep != null) (d.sleep >= 7 ? sw : swo).push(d.avg);
    });
    push('Slept 7 hours or more', sw, swo);
    out.sort((x, y) => y.diff - x.diff);
    return out;
  }
  V.factorEffects = factorEffects;

  function statTile(label, value, sub) {
    return h('div.stat', h('span.stat-label', label), h('span.stat-value', value), sub ? h('span.stat-sub', sub) : null);
  }

  function dayDetail(key) {
    const list = D.list('checkins')
      .filter((c) => U.dayKey(c.ts) === key)
      .sort(U.byAsc((c) => c.ts));
    const entries = D.list('journal').filter((e) => U.dayKey(e.ts) === key);
    const wins = D.list('wins').filter((w) => U.dayKey(w.ts) === key);
    const body = h('div.day-detail');
    for (const c of list) {
      body.appendChild(
        h(
          'div.day-ci',
          h('div.day-ci-head', UI.moodDot(c.mood), h('strong', K.moodLabel(c.mood)), h('span.muted', U.fmtTime(c.ts))),
          c.emotions && c.emotions.length ? h('p.tags', c.emotions.map((x) => h('span.tag', x))) : null,
          c.activities && c.activities.length ? h('p.small.muted', c.activities.join(', ')) : null,
          c.note ? h('p.day-note', c.note) : null
        )
      );
    }
    if (entries.length) {
      body.appendChild(h('h3.mini-title', 'Journal'));
      for (const e of entries) {
        const fl = V.journalText.firstLines(e);
        body.appendChild(
          h(
            'button.link-row',
            {
              type: 'button',
              onclick: () => {
                s.close();
                R.go('entry', e.id);
              }
            },
            UI.icon('journal'),
            h('span', fl.title),
            UI.icon('chev')
          )
        );
      }
    }
    if (wins.length) {
      body.appendChild(h('h3.mini-title', 'Wins'));
      body.appendChild(h('ul.win-list', wins.map((w) => h('li.win', UI.icon('spark', 'win-ic'), h('span.win-text', w.text)))));
    }
    const s = UI.sheet({ title: U.fmtLongYear(U.parseDay(key)), body });
  }

  function winsSheet() {
    const all = D.list('wins').sort(U.byDesc((w) => w.ts));
    const body = h('div');
    let month = null;
    let ul = null;
    for (const w of all) {
      const mk = U.monthKey(w.ts);
      if (mk !== month) {
        month = mk;
        body.appendChild(h('h3.mini-title', U.fmtMonthYear(w.ts)));
        ul = h('ul.win-list');
        body.appendChild(ul);
      }
      ul.appendChild(h('li.win', UI.icon('spark', 'win-ic'), h('span.win-text', w.text), h('span.win-date', U.fmtDayMonth(w.ts))));
    }
    if (!all.length) body.appendChild(h('p.muted', 'No wins logged yet.'));
    UI.sheet({ title: 'All your wins', body });
  }

  function phqCard() {
    const tests = D.list('tests')
      .filter((t) => t.type === 'phq9')
      .sort(U.byAsc((t) => t.ts));
    const intro = 'The PHQ-9 is a short questionnaire used by GPs and NHS Talking Therapies. Taking it every couple of weeks shows how things are changing.';
    if (!tests.length) {
      return h(
        'section.card',
        h('h2.card-title', 'Depression check (PHQ-9)'),
        h('p.card-sub', intro),
        UI.btn('Take the check', () => R.go('phq'), { icon: 'clipboard', small: true }),
        h('p.fineprint', K.PHQ9.credit)
      );
    }
    const last = tests[tests.length - 1];
    const band = K.phqBand(last.score);
    const prev = tests.length > 1 ? tests[tests.length - 2] : null;
    let change = null;
    if (prev) {
      const dlt = last.score - prev.score;
      change = dlt === 0 ? 'Same as ' + U.fmtDayMonth(prev.ts) : (dlt < 0 ? 'Down ' + -dlt : 'Up ' + dlt) + (Math.abs(dlt) === 1 ? ' point' : ' points') + ' since ' + U.fmtDayMonth(prev.ts);
    }
    const chart = () =>
      CH.line({
        label: 'PHQ-9 scores over time',
        points: tests.map((t) => ({ key: U.dayKey(t.ts), y: t.score, t })),
        start: U.dayKey(tests[0].ts) === U.dayKey(last.ts) ? U.dayKey(U.addDays(new Date(last.ts), -14)) : U.dayKey(tests[0].ts),
        end: U.dayKey(last.ts),
        yMin: 0,
        yMax: 27,
        maxGap: 10000,
        leftPad: 40,
        height: 200,
        yTicks: [0, 5, 10, 15, 20, 27].map((v) => ({ v, label: String(v) })),
        endLabel: (p) => String(p.y),
        tip: (p) => CH.tipContent(p.y + ' · ' + K.phqBand(p.y).label, U.fmtLongYear(p.t.ts))
      });
    const table = () =>
      CH.table(
        'PHQ-9 results',
        ['Date', 'Score', 'Range'],
        tests
          .slice()
          .reverse()
          .map((t) => [U.fmtDayMonthYear(t.ts), String(t.score), K.phqBand(t.score).label])
      );
    const sw = tests.length > 1 ? CH.switcher(chart, table) : null;
    return h(
      'section.card.viz-card',
      h('div.card-head', h('div', h('h2.card-title', 'Depression check (PHQ-9)'), h('p.card-sub', 'Scores run from 0 to 27. Lower means fewer symptoms.')), sw ? sw.toggle : null),
      h(
        'div.phq-summary',
        h('div.stat', h('span.stat-label', 'Latest score'), h('span.stat-value', String(last.score)), h('span.stat-sub', band.label + ' · ' + U.fmtDayMonth(last.ts))),
        change ? h('p.phq-change', change) : null
      ),
      sw ? sw.body : null,
      h('div.actions', UI.btn('Take it again', () => R.go('phq'), { small: true, icon: 'clipboard' })),
      h('p.fineprint', 'This is a screening questionnaire, not a diagnosis. ' + K.PHQ9.credit)
    );
  }

  V.insights = {
    live: true,
    render(root) {
      const range = getRange();
      const end = U.todayKey();
      const start = U.dayKey(U.addDays(new Date(), -(range - 1)));
      root.appendChild(h('div.page-head', h('h1.page-title', 'Insights')));
      root.appendChild(
        h(
          'div.filter-row',
          UI.segmented({ label: 'Time range', value: range, options: RANGES, onChange: setRange, id: 'range-filter' }),
          h('span.filter-note', U.fmtDayMonth(U.parseDay(start)) + ' to ' + U.fmtDayMonth(U.parseDay(end)))
        )
      );

      const days = dailyStats(start, end);
      const inRange = (r) => {
        const k = U.dayKey(r.ts);
        return k >= start && k <= end;
      };
      const checkins = D.list('checkins').filter(inRange);
      const entries = D.list('journal').filter(inRange);
      const wins = D.list('wins').filter(inRange);
      let stepsDone = 0;
      for (const g of D.list('goals')) {
        for (const st of g.steps || []) if (st.done && st.doneAt && inRange({ ts: st.doneAt })) stepsDone++;
        for (const k of g.log || []) if (k >= start && k <= end) stepsDone++;
      }

      const avg = checkins.length ? U.avg(checkins.map((c) => c.mood)) : null;
      const prevStart = U.dayKey(U.addDays(U.parseDay(start), -range));
      const prevEnd = U.dayKey(U.addDays(U.parseDay(start), -1));
      const prev = D.list('checkins').filter((c) => {
        const k = U.dayKey(c.ts);
        return k >= prevStart && k <= prevEnd;
      });
      let moodSub = avg != null ? K.moodLabel(avg) : 'No check-ins yet';
      if (avg != null && prev.length >= 3) {
        const dlt = U.round1(avg - U.avg(prev.map((c) => c.mood)));
        moodSub += dlt === 0 ? ' · same as the ' + range + ' days before' : ' · ' + (dlt > 0 ? 'up ' : 'down ') + Math.abs(dlt).toFixed(1) + ' on the ' + range + ' days before';
      }
      root.appendChild(
        h(
          'section.stats',
          { 'aria-label': 'Summary' },
          statTile('Average mood', avg != null ? avg.toFixed(1) : '–', moodSub),
          statTile('Days checked in', String(days.size), 'of ' + range),
          statTile('Journal entries', String(entries.length)),
          statTile('Wins and steps', String(wins.length + stepsDone))
        )
      );

      if (days.size < 2) {
        root.appendChild(
          h(
            'section.card.sparse',
            h('h2.card-title', 'Patterns take a little time'),
            h('p', days.size ? 'Check in on a few more days and your mood chart will appear here.' : 'Once you’ve checked in on a few days, your mood over time, your month of lights and what seems to help will show up here.'),
            h('div.actions', UI.btn('Check in now', () => R.go('today'), { kind: 'primary', small: true }), L.app.demo ? null : UI.btn('See it with example data', () => L.app.enterDemo(), { small: true, kind: 'ghost' }))
          )
        );
      } else {
        const pts = [...days.values()].map((d) => ({ key: d.key, y: d.avg, n: d.n }));
        root.appendChild(
          CH.card({
            title: 'Mood over time',
            sub: 'Your daily average, from very low to great.',
            chart: () =>
              CH.line({
                label: 'Daily average mood',
                points: pts,
                start,
                end,
                yMin: 1,
                yMax: 5,
                yTicks: K.MOODS.map((m) => ({ v: m.v, label: m.label })),
                endLabel: (p) => K.moodLabel(p.y),
                tip: (p) => CH.tipContent(K.moodLabel(p.y) + ' · ' + p.y.toFixed(1), U.fmtLong(U.parseDay(p.key)), U.plural(p.n, 'check-in'))
              }),
            table: () =>
              CH.table(
                'Daily average mood',
                ['Day', 'Mood', 'Average', 'Check-ins'],
                pts
                  .slice()
                  .sort(U.byDesc((p) => p.key))
                  .map((p) => [U.fmtShort(U.parseDay(p.key)), K.moodLabel(p.y), p.y.toFixed(1), String(p.n)])
              )
          })
        );
      }

      /* Month of lights, covering the range. */
      const cal = h('section.card.cal-card', h('div.card-head', h('div', h('h2.card-title', 'Your month of lights'), h('p.card-sub', 'Each day is coloured by its average mood. Tap a day to look back at it.'))));
      const months = [];
      const s0 = U.parseDay(start);
      const cur = new Date(s0.getFullYear(), s0.getMonth(), 1);
      while (U.monthKey(cur) <= U.monthKey(new Date())) {
        months.push([cur.getFullYear(), cur.getMonth()]);
        cur.setMonth(cur.getMonth() + 1);
      }
      const allDays = dailyStats(U.dayKey(new Date(months[0][0], months[0][1], 1)), end);
      const compact = range >= 90;
      const wrap = h('div.cal-wrap' + (compact ? '.compact' : ''));
      for (const [y, m] of compact ? months : months.slice().reverse()) wrap.appendChild(CH.month({ year: y, month: m, days: allDays, onPick: dayDetail, compact }));
      cal.appendChild(wrap);
      cal.appendChild(CH.moodLegend());
      root.appendChild(cal);

      /* What seems to help */
      const effects = factorEffects(days);
      const help = h('section.card', h('h2.card-title', 'What seems to help'), h('p.card-sub', 'Your average mood on days that included each thing, compared with days that didn’t.'));
      if (!effects.length) {
        help.appendChild(h('p.muted', 'Tag what your days include when you check in. Once something has come up on at least three days, and been missing on three others, it will appear here.'));
      } else {
        const rows = effects.slice(0, 5).concat(effects.length > 5 ? effects.slice(-3).filter((e) => e.diff < 0 && effects.indexOf(e) >= 5) : []);
        const max = Math.max(1, ...rows.map((r) => Math.abs(r.diff)));
        help.appendChild(
          CH.diverging({
            max,
            format: (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1),
            rows: rows.map((r) => ({
              label: r.label,
              value: r.diff,
              aria: r.label + ': ' + r.withAvg.toFixed(1) + ' on ' + r.nW + ' days with it, ' + r.withoutAvg.toFixed(1) + ' on ' + r.nWo + ' days without',
              tip: CH.tipContent(
                (r.diff >= 0 ? '+' : '−') + Math.abs(r.diff).toFixed(1),
                r.label,
                r.withAvg.toFixed(1) + ' with it (' + U.plural(r.nW, 'day') + ') · ' + r.withoutAvg.toFixed(1) + ' without (' + U.plural(r.nWo, 'day') + ')'
              )
            }))
          })
        );
        help.appendChild(h('p.fineprint', 'These are patterns in your own check-ins, not proof of cause. They get more reliable the more days you log.'));
      }
      root.appendChild(help);

      /* Feelings */
      const counts = new Map();
      for (const c of checkins) for (const e of c.emotions || []) counts.set(e, (counts.get(e) || 0) + 1);
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      if (top.length) {
        root.appendChild(
          h(
            'section.card',
            h('h2.card-title', 'Feelings you noted most'),
            h('p.card-sub', 'How many check-ins mentioned each one.'),
            CH.bars({ rows: top.map(([label, n]) => ({ label, value: n })), max: top[0][1], format: (v) => String(v) })
          )
        );
      }

      root.appendChild(phqCard());

      /* Look back at a win */
      const allWins = D.list('wins');
      if (allWins.length) {
        const older = allWins.filter((w) => U.dayDiff(U.dayKey(w.ts), end) >= 3);
        const pick = older.length ? older[U.hashStr(end + '|win') % older.length] : null;
        root.appendChild(
          h(
            'section.card.lookback',
            h('h2.card-title', 'Look back'),
            h('p', 'You’ve logged ' + U.plural(allWins.length, 'win') + ' so far.'),
            pick ? h('figure.lookback-quote', h('blockquote', pick.text), h('figcaption', U.fmtLong(pick.ts))) : null,
            UI.btn('See all your wins', winsSheet, { small: true, kind: 'ghost', icon: 'spark' })
          )
        );
      }
    }
  };
})((window.Lantern = window.Lantern || {}));
