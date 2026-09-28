/* Lantern — Support: urgent help, helplines, your people, and your safety plan. */
(function (L) {
  'use strict';
  const U = L.util;
  const K = L.content;
  const UI = L.ui;
  const h = UI.h;
  const D = L.data;
  const R = L.router;
  const V = (L.views = L.views || {});

  const telHref = (n) => 'tel:' + String(n).replace(/[^\d+]/g, '');

  function numberRow(display, copyValue, what) {
    return h('span.number-row', h('span.line-number', display), UI.iconBtn('copy', 'Copy ' + (what || 'number'), () => UI.copy(copyValue, 'Number copied')));
  }

  function lineCard(l) {
    const acts = [];
    if (l.tel) acts.push(h('a.btn.small', { href: telHref(l.tel) }, UI.icon('phone'), h('span', 'Call')));
    if (l.sms) acts.push(h('a.btn.small', { href: 'sms:' + l.sms + (l.body ? '?&body=' + encodeURIComponent(l.body) : '') }, UI.icon('message'), h('span', 'Text')));
    if (l.url) acts.push(h('a.btn.small.ghost', { href: l.url, target: '_blank', rel: 'noopener noreferrer' }, UI.icon('link'), h('span', l.linkText || 'Website')));
    return h(
      'li.line-card',
      h('div.line-head', h('h3.line-name', l.name), l.display ? numberRow(l.display, l.copy || l.tel || l.display, l.name + ' number') : null),
      h('p.line-detail', l.detail),
      acts.length ? h('div.line-actions', acts) : null
    );
  }

  function urgentBox() {
    return h(
      'section.urgent',
      { 'aria-labelledby': 'urgent-title' },
      h('h2.urgent-title#urgent-title', 'In an emergency'),
      h('p', 'If you might act on thoughts of ending your life, or you’ve hurt yourself, call 999 or go to A&E now.'),
      h('div.actions', h('a.btn.primary.small', { href: 'tel:999' }, UI.icon('phone'), h('span', 'Call 999')), numberRow('999', '999', 'emergency number'))
    );
  }
  V.urgentBox = urgentBox;

  /* The parts of Support that never need your data: shown on the lock screen too. */
  function helplineList() {
    return h('ul.line-list', K.HELPLINES.map(lineCard));
  }
  V.helplineList = helplineList;

  function peopleList(plan) {
    const people = []
      .concat((plan.people || []).map((p) => Object.assign({ group: 'people' }, p)))
      .concat((plan.pros || []).map((p) => Object.assign({ group: 'pros' }, p)))
      .filter((p) => !U.isBlank(p.name) || !U.isBlank(p.phone));
    if (!people.length) return null;
    return h(
      'ul.line-list',
      people.map((p) =>
        h(
          'li.line-card',
          h('div.line-head', h('h3.line-name', p.name || 'Someone I trust'), p.phone ? numberRow(p.phone, p.phone, (p.name || 'this') + ' number') : null),
          p.phone ? h('div.line-actions', h('a.btn.small', { href: telHref(p.phone) }, UI.icon('phone'), h('span', 'Call')), h('a.btn.small.ghost', { href: 'sms:' + String(p.phone).replace(/[^\d+]/g, '') }, UI.icon('message'), h('span', 'Text'))) : null
        )
      )
    );
  }

  function planSummary(plan) {
    const filled = K.SAFETY_SECTIONS.filter((s) => (plan[s.k] || []).some((x) => (s.person ? !U.isBlank(x.name) || !U.isBlank(x.phone) : !U.isBlank(x))));
    if (!filled.length) {
      return h(
        'div.plan-empty',
        h('p', 'A safety plan is a short list you write while you feel steadier, for the moments when things get hard: your warning signs, what helps, and who to contact. Many mental health services use them, and it only takes a few minutes to start.'),
        UI.btn('Make my plan', () => R.go('plan'), { kind: 'primary', icon: 'shield' })
      );
    }
    const ol = h('ol.plan-list');
    K.SAFETY_SECTIONS.forEach((s, i) => {
      const items = (plan[s.k] || []).filter((x) => (s.person ? !U.isBlank(x.name) || !U.isBlank(x.phone) : !U.isBlank(x)));
      if (!items.length) return;
      ol.appendChild(
        h(
          'li.plan-sec',
          h('h3.plan-title', h('span.plan-num', String(i + 1)), s.title),
          h('ul.plan-items', items.map((x) => h('li', s.person ? [x.name || 'Someone', x.phone ? h('span.muted', ' · ' + x.phone) : null] : x)))
        )
      );
    });
    const left = K.SAFETY_SECTIONS.length - filled.length;
    return h(
      'div.plan-empty',
      ol,
      left ? h('p.plan-more', left === 1 ? 'One more section to fill in when you’re ready.' : left + ' more sections to fill in when you’re ready.') : null,
      UI.btn(left ? 'Keep filling in my plan' : 'Edit my plan', () => R.go('plan'), { icon: 'edit', small: true })
    );
  }

  V.support = {
    live: true,
    render(root) {
      const plan = D.state.safety || {};
      root.appendChild(h('div.page-head', h('div', h('h1.page-title', 'Support'), h('p.lead', 'You don’t have to get through this on your own.'))));
      root.appendChild(urgentBox());
      root.appendChild(h('h2.section-title', 'Talk to someone now'));
      root.appendChild(h('p.section-sub', 'Free, confidential, and there for anything, not only emergencies.'));
      root.appendChild(helplineList());
      const people = peopleList(plan);
      if (people) {
        root.appendChild(h('h2.section-title', 'My people'));
        root.appendChild(people);
      }
      root.appendChild(h('section.card.plan-card', h('div.card-head', h('h2.card-title', UI.icon('shield'), 'My safety plan')), planSummary(plan)));
      root.appendChild(h('h2.section-title', 'Ongoing support'));
      root.appendChild(h('ul.line-list', K.INFO_LINES.map(lineCard)));
      root.appendChild(h('p.fineprint', 'These services are for the UK and were checked in September 2026. If a number doesn’t work, Samaritans on 116 123 are always there.'));
    }
  };

  /* ---------- safety plan editor ---------- */
  V.plan = {
    live: false,
    render(root) {
      const plan = U.clone(D.state.safety) || {};
      for (const s of K.SAFETY_SECTIONS) if (!Array.isArray(plan[s.k])) plan[s.k] = [];
      const status = h('span.save-status', { 'aria-live': 'polite' }, 'Saved');
      const save = U.debounce(async () => {
        status.textContent = 'Saving…';
        await D.putSingle('safety', plan);
        status.textContent = 'Saved';
      }, 600);
      const changed = () => {
        status.textContent = 'Editing…';
        save();
      };
      V.plan.flush = () => save.flush();
      V.plan.leave = () => save.flush();

      root.appendChild(
        h(
          'div.editor-bar',
          h('button.back-btn', { type: 'button', onclick: () => R.back('support') }, UI.icon('back'), h('span', 'Support')),
          status,
          UI.btn('Done', () => {
            save.flush();
            R.back('support');
          }, { kind: 'primary', small: true })
        )
      );
      root.appendChild(h('h1.page-title', 'My safety plan'));
      root.appendChild(
        h('p.lead', 'Fill this in while you feel steadier, so it’s ready when you need it. Work through it in order when things get hard. Write what you can, and come back to it any time.')
      );
      const ol = h('ol.plan-edit');
      K.SAFETY_SECTIONS.forEach((s, idx) => {
        const list = h('div.plan-inputs');
        const paint = () => {
          UI.clear(list);
          if (!plan[s.k].length) plan[s.k].push(s.person ? { name: '', phone: '' } : '');
          plan[s.k].forEach((item, i) => {
            const remove = UI.iconBtn('x', 'Remove', () => {
              plan[s.k].splice(i, 1);
              paint();
              changed();
            });
            if (s.person) {
              list.appendChild(
                h(
                  'div.person-row',
                  h('input.input', {
                    type: 'text',
                    maxlength: 80,
                    placeholder: 'Name',
                    'aria-label': s.title + ': name',
                    value: item.name || '',
                    oninput: (e) => {
                      item.name = e.target.value;
                      changed();
                    }
                  }),
                  h('input.input', {
                    type: 'tel',
                    maxlength: 40,
                    placeholder: 'Phone number',
                    'aria-label': s.title + ': phone number',
                    value: item.phone || '',
                    oninput: (e) => {
                      item.phone = e.target.value;
                      changed();
                    }
                  }),
                  remove
                )
              );
            } else {
              list.appendChild(
                h(
                  'div.item-row',
                  h('input.input', {
                    type: 'text',
                    maxlength: 200,
                    placeholder: s.ph,
                    'aria-label': s.title,
                    value: item,
                    oninput: (e) => {
                      plan[s.k][i] = e.target.value;
                      changed();
                    }
                  }),
                  remove
                )
              );
            }
          });
        };
        paint();
        ol.appendChild(
          h(
            'li.plan-sec',
            h('h2.plan-title', h('span.plan-num', String(idx + 1)), s.title),
            h('p.help', s.help),
            list,
            h(
              'button.link-btn',
              {
                type: 'button',
                onclick: () => {
                  plan[s.k].push(s.person ? { name: '', phone: '' } : '');
                  paint();
                  const inputs = list.querySelectorAll('input');
                  const last = inputs[s.person ? inputs.length - 2 : inputs.length - 1];
                  if (last) last.focus();
                }
              },
              '+ Add another'
            )
          )
        );
      });
      root.appendChild(ol);
      root.appendChild(h('p.fineprint', 'Based on the Stanley–Brown safety planning approach, which many mental health services use.'));
    }
  };
})((window.Lantern = window.Lantern || {}));
