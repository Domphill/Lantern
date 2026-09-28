/* Lantern — Journal: list, templates, editor with autosave, reading view. */
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

  const MAX_FIELD = 50000;

  function fieldText(e, f) {
    const v = (e.fields || {})[f.k];
    if (v == null || v === '') return '';
    if (f.type === 'scale') return v + (f.unit || '');
    if (f.type === 'chips') return Array.isArray(v) ? v.join(', ') : '';
    return String(v);
  }
  function allText(e) {
    const tpl = K.template(e.template);
    return [e.title || '', e.prompt || '', ...tpl.fields.map((f) => fieldText(e, f))].join('\n');
  }
  function hasContent(e) {
    if (!U.isBlank(e.title)) return true;
    const tpl = K.template(e.template);
    return tpl.fields.some((f) => {
      const v = (e.fields || {})[f.k];
      if (f.type === 'chips') return Array.isArray(v) && v.length > 0;
      if (f.type === 'scale') return v != null && v !== '';
      return !U.isBlank(v);
    });
  }
  const clip = (s, n) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s);
  /* A title and a short preview. Untitled entries use the first line of the first answer. */
  function firstLines(e) {
    const tpl = K.template(e.template);
    const texts = tpl.fields
      .filter((f) => f.type === 'long' || f.type === 'text')
      .map((f) => fieldText(e, f).trim())
      .filter(Boolean);
    const title = (e.title || '').trim();
    if (title) return { title, snippet: clip(texts.join(' · ').replace(/\s+/g, ' '), 160) };
    if (!texts.length) return { title: tpl.name, snippet: '' };
    const lines = texts[0].split(/\n+/);
    const head = lines[0].trim();
    let rest = lines.slice(1).join(' ');
    let t = head;
    if (head.length > 80) {
      t = clip(head, 80);
      rest = head.slice(t.length - 1) + ' ' + rest;
    }
    const snippet = [rest.trim()].concat(texts.slice(1)).filter(Boolean).join(' · ').replace(/\s+/g, ' ');
    return { title: t, snippet: clip(snippet, 160) };
  }
  V.journalText = { allText, hasContent, firstLines, fieldText };

  /* ---------- list ---------- */
  function pickTemplate() {
    const s = UI.sheet({
      title: 'New entry',
      body: h(
        'ul.tpl-list',
        K.TEMPLATES.map((t) =>
          h(
            'li',
            h(
              'button.tpl-item',
              {
                type: 'button',
                onclick: () => {
                  s.close();
                  R.go('new', t.id);
                }
              },
              h('span.tpl-text', h('span.tpl-name', t.name), h('span.tpl-blurb', t.blurb)),
              UI.icon('chev')
            )
          )
        )
      )
    });
  }

  V.journal = {
    live: true,
    pickTemplate,
    render(root) {
      const f = drafts.journalFilter || (drafts.journalFilter = { q: '', tpl: 'all' });
      root.appendChild(h('div.page-head', h('h1.page-title', 'Journal'), UI.btn('New entry', pickTemplate, { kind: 'primary', icon: 'plus' })));

      const all = D.list('journal').sort(U.byDesc((e) => e.ts));
      const prompt = U.pickDaily(K.PROMPTS, 'prompt');
      root.appendChild(
        h(
          'section.card.prompt-card.compact',
          h('p.eyebrow', 'Something to write about'),
          h('p.prompt-text', prompt),
          UI.btn('Write about this', () => {
            drafts.newPrompt = prompt;
            R.go('new', 'free');
          }, { small: true, icon: 'feather' })
        )
      );

      if (!all.length) {
        root.appendChild(
          UI.empty(
            'Your journal is empty',
            'Writing things down can make them a little easier to carry. Pick a template, or just write.',
            UI.btn('Start writing', pickTemplate, { kind: 'primary', icon: 'feather' })
          )
        );
        return;
      }

      const used = K.TEMPLATES.filter((t) => all.some((e) => e.template === t.id));
      const search = h('input.input.search-input#journal-search', {
        type: 'search',
        placeholder: 'Search your journal',
        'aria-label': 'Search your journal',
        value: f.q,
        oninput: U.debounce((e) => {
          f.q = e.target.value;
          L.app.render();
        }, 200)
      });
      const tools = h('div.list-tools', h('div.search-box', UI.icon('search', 'search-ic'), search));
      if (used.length > 1) {
        if (f.tpl !== 'all' && !used.some((t) => t.id === f.tpl)) f.tpl = 'all';
        tools.appendChild(
          h(
            'select.input.select#journal-type',
            {
              'aria-label': 'Show entries of type',
              value: f.tpl,
              onchange: (e) => {
                f.tpl = e.target.value;
                L.app.render();
              }
            },
            h('option', { value: 'all' }, 'All types'),
            used.map((t) => h('option', { value: t.id }, t.name))
          )
        );
      }
      root.appendChild(tools);

      const q = f.q.trim().toLowerCase();
      const shown = all.filter((e) => (f.tpl === 'all' || e.template === f.tpl) && (!q || allText(e).toLowerCase().includes(q)));
      if (!shown.length) {
        root.appendChild(h('p.muted.center', 'Nothing matches that search.'));
        return;
      }
      root.appendChild(h('p.list-count', { 'aria-live': 'polite' }, U.plural(shown.length, 'entry', 'entries')));
      let month = null;
      let ul = null;
      for (const e of shown) {
        const d = new Date(e.ts);
        const mk = U.monthKey(d);
        if (mk !== month) {
          month = mk;
          root.appendChild(h('h2.month-title', U.fmtMonthYear(d)));
          ul = h('ul.entry-list');
          root.appendChild(ul);
        }
        const tpl = K.template(e.template);
        const fl = firstLines(e);
        ul.appendChild(
          h(
            'li',
            h(
              'button.entry-item',
              { type: 'button', onclick: () => R.go('entry', e.id) },
              h('span.entry-date', { 'aria-hidden': 'true' }, h('span.entry-day', String(d.getDate())), h('span.entry-wd', U.fmtWeekday(d))),
              h(
                'span.entry-main',
                h('span.entry-title', fl.title),
                fl.snippet ? h('span.entry-snippet', fl.snippet) : null,
                h('span.entry-meta', e.mood ? UI.moodDot(e.mood) : null, h('span', tpl.name + ' · ' + U.fmtShort(d) + ', ' + U.fmtTime(d)))
              )
            )
          )
        );
      }
    }
  };

  /* ---------- editor ---------- */
  const ED = { rec: null, persisted: false, autosave: null, status: null };

  function scaleField(f, rec, onChange) {
    const v = rec.fields[f.k];
    const out = h('output.scale-val', v == null ? 'Not set' : v + (f.unit || ''));
    const input = h('input.range#ed-' + f.k, {
      type: 'range',
      min: f.min,
      max: f.max,
      step: f.step,
      value: v == null ? Math.round((f.min + f.max) / 2) : v,
      'aria-label': f.label,
      class: v == null ? 'unset' : null,
      oninput: (e) => {
        rec.fields[f.k] = Number(e.target.value);
        out.textContent = e.target.value + (f.unit || '');
        e.target.classList.remove('unset');
        onChange();
      }
    });
    return h('div.field', h('span.label', f.label), h('div.scale-row', input, out), h('span.help.scale-ends', h('span', 'Barely'), h('span', 'Overwhelming')));
  }

  function renderEditor(root, rec, isNew) {
    const tpl = K.template(rec.template);
    ED.rec = rec;
    ED.persisted = !isNew;
    const status = h('span.save-status#ed-status', { 'aria-live': 'polite' }, isNew ? 'Not saved yet' : 'Saved');
    ED.status = status;

    async function saveNow() {
      if (!hasContent(rec)) return;
      status.textContent = 'Saving…';
      await D.put('journal', rec);
      ED.persisted = true;
      status.textContent = 'Saved';
      if (R.current.name === 'new') {
        R.current = { name: 'edit', arg: rec.id };
        R._writeHash(R.current);
      }
    }
    if (ED.autosave) ED.autosave.cancel();
    ED.autosave = U.debounce(saveNow, 700);
    const changed = () => {
      status.textContent = 'Editing…';
      ED.autosave();
    };

    const done = async () => {
      ED.autosave.flush();
      await D.chain;
      if (hasContent(rec)) {
        const top = R.stack[R.stack.length - 1];
        if (top && top.name === 'entry' && top.arg === rec.id) R.back('journal');
        else R.go('entry', rec.id, { replace: true });
      } else {
        if (ED.persisted) await D.remove('journal', rec.id);
        ED.rec = null;
        R.go('journal', null, { replace: true });
      }
    };
    const goBack = async () => {
      ED.autosave.flush();
      await D.chain;
      R.back('journal');
    };

    root.appendChild(
      h(
        'div.editor-bar',
        h('button.back-btn', { type: 'button', onclick: goBack }, UI.icon('back'), h('span', 'Back')),
        status,
        UI.btn('Done', done, { kind: 'primary', small: true, id: 'ed-done' })
      )
    );

    const when = h('input.input.when-input#ed-when', {
      type: 'datetime-local',
      value: U.toLocalInput(rec.ts),
      'aria-label': 'Date and time',
      onchange: (e) => {
        const d = U.fromLocalInput(e.target.value);
        if (d) {
          rec.ts = d.toISOString();
          changed();
        }
      }
    });
    const ed = h('article.editor');
    ed.appendChild(h('div.editor-meta', h('span.eyebrow', tpl.name), when));
    if (tpl.id !== 'free' && tpl.blurb) ed.appendChild(h('p.editor-blurb', tpl.blurb));
    if (rec.prompt) ed.appendChild(h('blockquote.prompt-quote', rec.prompt));
    ed.appendChild(
      h('input.title-input#ed-title', {
        type: 'text',
        maxlength: 140,
        placeholder: 'Title (optional)',
        'aria-label': 'Title',
        value: rec.title || '',
        oninput: (e) => {
          rec.title = e.target.value;
          changed();
        }
      })
    );

    for (const f of tpl.fields) {
      if (f.type === 'long') {
        const ta = UI.autoGrow(
          h('textarea.input.journal-text#ed-' + f.k, {
            rows: f.rows || 3,
            maxlength: MAX_FIELD,
            placeholder: f.placeholder || '',
            'aria-label': f.label || 'Entry',
            value: rec.fields[f.k] || '',
            oninput: (e) => {
              rec.fields[f.k] = e.target.value;
              changed();
            }
          })
        );
        ed.appendChild(f.label ? UI.field(f.label, ta, f.help) : ta);
      } else if (f.type === 'text') {
        ed.appendChild(
          UI.field(
            f.label,
            h('input.input#ed-' + f.k, {
              type: 'text',
              maxlength: 300,
              placeholder: f.placeholder || '',
              value: rec.fields[f.k] || '',
              oninput: (e) => {
                rec.fields[f.k] = e.target.value;
                changed();
              }
            }),
            f.help
          )
        );
      } else if (f.type === 'scale') {
        ed.appendChild(scaleField(f, rec, changed));
      } else if (f.type === 'chips') {
        const sel = new Set(rec.fields[f.k] || []);
        const details =
          f.k === 'traps'
            ? h(
                'details.traps-help',
                h('summary', 'What do these mean?'),
                h(
                  'dl.traps',
                  K.TRAPS.map((t) => [h('dt', t.t), h('dd', t.d)])
                )
              )
            : null;
        ed.appendChild(
          h(
            'div.field',
            h('span.label', f.label),
            f.help ? h('span.help', f.help) : null,
            UI.chips({
              label: f.label,
              options: f.options,
              selected: sel,
              onToggle: (t, on) => {
                if (on) sel.add(t);
                else sel.delete(t);
                rec.fields[f.k] = f.options.filter((o) => sel.has(o));
                changed();
              }
            }),
            details
          )
        );
      }
    }

    const moodWrap = h('div.field.editor-mood');
    const paintMood = () => {
      UI.clear(moodWrap);
      moodWrap.appendChild(h('span.label', 'How are you feeling? (optional)'));
      moodWrap.appendChild(
        V.moodPicker(
          rec.mood || null,
          (v) => {
            rec.mood = rec.mood === v ? null : v;
            paintMood();
            changed();
          },
          { small: true, label: 'Mood for this entry' }
        )
      );
    };
    paintMood();
    ed.appendChild(moodWrap);

    const foot = h('div.editor-foot');
    if (tpl.id === 'free') {
      const wc = h('span.muted', U.plural(U.words(rec.fields.body), 'word'));
      ed.addEventListener('input', () => {
        wc.textContent = U.plural(U.words(rec.fields.body), 'word');
      });
      foot.appendChild(wc);
    } else foot.appendChild(h('span'));
    foot.appendChild(
      UI.btn('Delete entry', async () => {
        const ok = await UI.confirm({ title: 'Delete this entry?', body: 'This can’t be undone once you leave this page.', confirm: 'Delete', danger: true });
        if (!ok) return;
        ED.autosave.cancel();
        const snapshot = U.clone(rec);
        if (ED.persisted) await D.remove('journal', rec.id);
        ED.rec = null;
        R.go('journal', null, { replace: true });
        if (ED.persisted) UI.toast('Entry deleted', { action: { label: 'Undo', run: () => D.put('journal', snapshot, { touch: false }) } });
      }, { kind: 'ghost.danger-text', small: true, icon: 'trash' })
    );
    ed.appendChild(foot);
    root.appendChild(ed);

    if (isNew) {
      requestAnimationFrame(() => {
        const first = root.querySelector('textarea');
        if (first && window.matchMedia('(pointer: fine)').matches) first.focus({ preventScroll: true });
      });
    }
  }

  function leaveEditor() {
    if (!ED.rec) return;
    const rec = ED.rec;
    if (ED.autosave) ED.autosave.flush();
    if (!hasContent(rec) && ED.persisted) D.remove('journal', rec.id);
    ED.rec = null;
  }
  function flushEditor() {
    if (ED.rec && ED.autosave) ED.autosave.flush();
  }

  V.new = {
    live: false,
    leave: leaveEditor,
    flush: flushEditor,
    render(root, tplId) {
      const tpl = K.template(tplId);
      const now = U.nowIso();
      const rec = { id: U.uid(), created: now, ts: now, template: tpl.id, title: '', fields: {}, mood: null };
      if (drafts.newPrompt) {
        rec.prompt = drafts.newPrompt;
        drafts.newPrompt = null;
      }
      renderEditor(root, rec, true);
    }
  };

  V.edit = {
    live: false,
    leave: leaveEditor,
    flush: flushEditor,
    render(root, id) {
      if (ED.rec && ED.rec.id === id) {
        renderEditor(root, ED.rec, !ED.persisted);
        return;
      }
      const e = D.get('journal', id);
      if (!e) {
        root.appendChild(UI.empty('Entry not found', 'It may have been deleted.', UI.btn('Back to journal', () => R.go('journal'))));
        return;
      }
      const rec = U.clone(e);
      rec.fields = rec.fields || {};
      renderEditor(root, rec, false);
    }
  };

  /* ---------- reading view ---------- */
  function prose(text) {
    const paras = String(text).split(/\n\s*\n/);
    return h('div.prose', paras.map((p) => h('p', p)));
  }

  V.entry = {
    live: true,
    render(root, id) {
      const e = D.get('journal', id);
      if (!e) {
        root.appendChild(UI.empty('Entry not found', 'It may have been deleted.', UI.btn('Back to journal', () => R.go('journal'))));
        return;
      }
      const tpl = K.template(e.template);
      const d = new Date(e.ts);
      root.appendChild(
        h(
          'div.editor-bar',
          h('button.back-btn', { type: 'button', onclick: () => R.back('journal') }, UI.icon('back'), h('span', 'Journal')),
          h('span'),
          UI.btn('Edit', () => R.go('edit', e.id), { small: true, icon: 'edit' })
        )
      );
      const art = h('article.entry-view');
      art.appendChild(h('p.eyebrow', tpl.name + ' · ' + U.fmtLongYear(d) + ', ' + U.fmtTime(d)));
      if (e.prompt) art.appendChild(h('blockquote.prompt-quote', e.prompt));
      art.appendChild(h('h1.entry-heading', (e.title || '').trim() || (tpl.id === 'free' ? U.fmtLong(d) : firstLines(e).title)));
      if (e.mood) art.appendChild(h('p.entry-mood', UI.moodDot(e.mood), 'Feeling ' + K.moodLabel(e.mood).toLowerCase()));
      if (tpl.id === 'free') {
        const body = fieldText(e, tpl.fields[0]);
        art.appendChild(body.trim() ? prose(body) : h('p.muted', 'This entry has no text yet.'));
      } else {
        const scales = tpl.fields.filter((f) => f.type === 'scale');
        for (const f of tpl.fields) {
          if (f.type === 'scale') continue;
          const t = fieldText(e, f);
          if (!t.trim()) continue;
          art.appendChild(h('section.entry-field', h('h2.entry-field-label', f.label), f.type === 'chips' ? h('p.tags', (e.fields[f.k] || []).map((x) => h('span.tag', x))) : prose(t)));
        }
        if (scales.length === 2 && tpl.id === 'thought') {
          const a = e.fields.before;
          const b = e.fields.after;
          if (a != null || b != null) {
            const body =
              a != null && b != null
                ? h('p.shift', h('span.shift-num', a + '%'), UI.icon('chev'), h('span.shift-num', b + '%'), b < a ? h('span.muted', 'Down ' + (a - b) + ' points') : b > a ? h('span.muted', 'Up ' + (b - a) + ' points') : h('span.muted', 'No change'))
                : h('p.shift', h('span.shift-num', (a != null ? a : b) + '%'), h('span.muted', a != null ? 'at the time' : 'afterwards'));
            art.appendChild(h('section.entry-field', h('h2.entry-field-label', 'Strength of the feeling'), body));
          }
        }
      }
      root.appendChild(art);
      root.appendChild(
        h(
          'div.entry-foot',
          UI.btn('Delete entry', async () => {
            const ok = await UI.confirm({ title: 'Delete this entry?', body: 'You can undo this straight afterwards.', confirm: 'Delete', danger: true });
            if (!ok) return;
            const snapshot = U.clone(e);
            await D.remove('journal', e.id);
            R.go('journal', null, { replace: true });
            UI.toast('Entry deleted', { action: { label: 'Undo', run: () => D.put('journal', snapshot, { touch: false }) } });
          }, { kind: 'ghost.danger-text', small: true, icon: 'trash' })
        )
      );
    }
  };
})((window.Lantern = window.Lantern || {}));
