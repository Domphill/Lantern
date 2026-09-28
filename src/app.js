/* Lantern — app shell: boot, storage choice, navigation chrome, onboarding, lock screen. */
(function (L) {
  'use strict';
  const U = L.util;
  const K = L.content;
  const UI = L.ui;
  const h = UI.h;
  const D = L.data;
  const R = L.router;
  const S = L.store;
  const C = L.crypto;
  const V = (L.views = L.views || {});
  const drafts = (L.drafts = L.drafts || {});

  const TABS = [
    { name: 'today', label: 'Today', icon: 'today' },
    { name: 'journal', label: 'Journal', icon: 'journal', also: ['entry', 'edit', 'new'] },
    { name: 'goals', label: 'Goals', icon: 'goals', also: ['goal'] },
    { name: 'insights', label: 'Insights', icon: 'insights' },
    { name: 'toolkit', label: 'Toolkit', icon: 'toolkit', also: ['breathe', 'ground', 'ideas', 'compassion', 'phq'] }
  ];

  const App = (L.app = {
    mode: 'local',
    demo: false,
    realBackend: null,
    started: false,
    cloudFallback: false,
    els: {},
    currentView: null,
    hiddenAt: 0,
    failedAttempts: 0,
    writeErrors: 0
  });

  /* ---------- theme ---------- */
  App.applyTheme = (theme) => {
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') {
      root.setAttribute('data-theme', theme);
      App._themeSet = true;
    } else if (App._themeSet) {
      root.removeAttribute('data-theme');
      App._themeSet = false;
    }
    try {
      localStorage.setItem('lantern.theme', theme || 'system');
    } catch (e) {
      /* optional */
    }
  };

  /* ---------- shell ---------- */
  function buildShell() {
    const mount = document.getElementById('app');
    UI.clear(mount);
    const status = h('button.save-pill#save-pill', { type: 'button', hidden: true, onclick: showSaveProblem });
    const lockBtn = UI.iconBtn('lock', 'Lock Lantern', () => App.lock(), { id: 'lock-btn' });
    lockBtn.hidden = true;
    const topbar = h(
      'header.topbar',
      h('button.brand', { type: 'button', onclick: () => R.go('today'), 'aria-label': 'Lantern, go to Today' }, UI.logo(30), h('span.brand-name', 'Lantern')),
      h(
        'div.topbar-right',
        status,
        lockBtn,
        h('button.support-btn', { type: 'button', onclick: () => R.go('support') }, UI.icon('support'), h('span', 'Support')),
        UI.iconBtn('settings', 'Settings', () => R.go('settings'), { id: 'settings-btn' })
      )
    );
    const tabs = h(
      'nav.tabs',
      { 'aria-label': 'Main' },
      h('div.rail-brand', UI.logo(34), h('span.brand-name', 'Lantern')),
      TABS.map((t) => h('button.tab', { type: 'button', 'data-tab': t.name, onclick: () => R.go(t.name) }, UI.icon(t.icon), h('span.tab-label', t.label))),
      h(
        'div.rail-foot',
        h('button.tab.rail-extra', { type: 'button', 'data-tab': 'support', onclick: () => R.go('support') }, UI.icon('support'), h('span.tab-label', 'Support')),
        h('button.tab.rail-extra', { type: 'button', 'data-tab': 'settings', onclick: () => R.go('settings') }, UI.icon('settings'), h('span.tab-label', 'Settings'))
      )
    );
    const main = h('main#main', { tabindex: '-1' });
    const shell = h('div.shell', topbar, tabs, main);
    mount.appendChild(shell);
    mount.appendChild(h('div#layer'));
    mount.appendChild(h('div#toasts', { 'aria-live': 'polite', 'aria-atomic': 'false' }));
    App.els = { mount, shell, topbar, tabs, main, status, lockBtn };
  }

  function setChrome(on) {
    App.els.shell.classList.toggle('bare', !on);
  }

  function updateTabs(name) {
    for (const b of App.els.tabs.querySelectorAll('[data-tab]')) {
      const t = TABS.find((x) => x.name === b.dataset.tab);
      const on = b.dataset.tab === name || (t && t.also && t.also.includes(name)) || (b.dataset.tab === 'support' && name === 'plan');
      if (on) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    App.els.lockBtn.hidden = !D.meta || App.demo;
  }

  function banners() {
    const out = [];
    if (App.demo) {
      out.push(
        h(
          'div.banner.banner-demo',
          { role: 'status' },
          h('span', 'You’re looking at example data. Nothing here is saved, and your own entries are untouched.'),
          UI.btn('Leave example', () => App.exitDemo(), { small: true })
        )
      );
    } else if (App.mode === 'memory') {
      out.push(h('div.banner.banner-warn', { role: 'alert' }, h('span', 'This browser isn’t letting Lantern save anything. Your entries will be lost when you close the page, so download a backup from Settings.')));
    } else if (App.cloudFallback) {
      out.push(h('div.banner.banner-warn', { role: 'status' }, h('span', 'Lantern couldn’t reach your claude.ai storage, so entries are being kept in this browser only.')));
    }
    if (App.writeErrors && !App.demo) {
      out.push(
        h(
          'div.banner.banner-warn',
          { role: 'alert' },
          h('span', 'Some changes couldn’t be saved. Download a backup from Settings so nothing is lost.'),
          UI.btn('Settings', () => R.go('settings'), { small: true })
        )
      );
    }
    return out;
  }

  /* ---------- render loop ---------- */
  App.render = (opts) => {
    opts = opts || {};
    if (!App.started || D.locked) return;
    const main = App.els.main;
    const isView = (n) => !!V[n] && typeof V[n].render === 'function';
    if (R.current.name === 'welcome' && D.profile().onboarded) R.current = { name: 'today', arg: null };
    if (!isView(R.current.name)) R.current = { name: 'today', arg: null };
    const view = V[R.current.name];
    if (App.currentView && App.currentView !== view && App.currentView.leave) {
      try {
        App.currentView.leave();
      } catch (e) {
        console.error(e);
      }
    }
    const active = document.activeElement;
    const keep = !opts.nav && active && active.id && main.contains(active) ? { id: active.id, start: active.selectionStart, end: active.selectionEnd } : null;
    const scrollY = window.scrollY;
    L.charts.tipHide();
    UI.clear(main);
    setChrome(R.current.name !== 'welcome');
    for (const b of banners()) main.appendChild(b);
    const container = h('div.view.view-' + R.current.name);
    main.appendChild(container);
    try {
      view.render(container, R.current.arg);
    } catch (e) {
      console.error(e);
      container.appendChild(
        h('div.card', h('h2.card-title', 'Something went wrong on this page.'), h('p', 'Your entries are safe. Try going back to Today.'), h('pre.error-text', String((e && e.message) || e)), UI.btn('Go to Today', () => R.go('today')))
      );
    }
    App.currentView = view;
    updateTabs(R.current.name);
    if (opts.nav) {
      window.scrollTo(0, 0);
      const hd = container.querySelector('h1');
      if (hd && document.activeElement !== document.body && !container.contains(document.activeElement)) {
        hd.setAttribute('tabindex', '-1');
        hd.focus({ preventScroll: true });
      }
    } else {
      window.scrollTo(0, scrollY);
      if (keep) {
        const el = document.getElementById(keep.id);
        if (el && el.focus) {
          el.focus({ preventScroll: true });
          try {
            if (keep.start != null) el.setSelectionRange(keep.start, keep.end);
          } catch (e) {
            /* not a text field */
          }
        }
      }
    }
  };
  App.scheduleRender = () => {
    if (App._raf) return;
    App._raf = requestAnimationFrame(() => {
      App._raf = null;
      App.render();
    });
  };

  /* ---------- saving status ---------- */
  /* Quiet unless a save is slow or failing. */
  function updateStatus(s) {
    const pill = App.els.status;
    if (!pill) return;
    clearTimeout(App._pillT);
    if (App.demo) {
      pill.hidden = true;
      return;
    }
    const show = (state, text) => {
      pill.hidden = false;
      pill.dataset.state = state;
      pill.textContent = text;
    };
    if (s === 'saving') {
      if (pill.hidden) App._pillT = setTimeout(() => show('saving', 'Saving…'), 700);
      else show('saving', 'Saving…');
    } else if (s === 'saved') {
      if (!pill.hidden) {
        show('saved', 'Saved');
        App._pillT = setTimeout(() => (pill.hidden = true), 1200);
      }
    } else show(s, s === 'retrying' ? 'Offline, will retry' : 'Not saved');
  }
  function showSaveProblem() {
    const st = App.els.status.dataset.state;
    if (st === 'retrying') UI.toast('Lantern can’t reach its storage right now. It will keep trying while this page is open.');
    else if (st === 'error') UI.toast('Some changes couldn’t be saved. Download a backup from Settings so nothing is lost.');
  }

  /* ---------- lock ---------- */
  App.flushDrafts = () => {
    for (const v of Object.values(V)) {
      if (v && typeof v.flush === 'function') {
        try {
          v.flush();
        } catch (e) {
          /* ignore */
        }
      }
    }
  };
  App.lock = async () => {
    if (!D.meta || App.demo) return;
    App.flushDrafts();
    if (App.currentView && App.currentView.leave) {
      try {
        App.currentView.leave();
      } catch (e) {
        /* ignore */
      }
    }
    App.currentView = null;
    await D.chain;
    await D.lockNow();
  };

  function supportSheet() {
    UI.sheet({
      title: 'Support',
      wide: true,
      body: h('div', V.urgentBox(), h('h3.section-title', 'Talk to someone now'), V.helplineList())
    });
  }

  App.showLock = () => {
    const main = App.els.main;
    UI.clear(main);
    setChrome(false);
    L.charts.tipHide();
    document.querySelectorAll('.sheet-wrap, .celebrate').forEach((el) => el.remove());
    const err = h('p.form-error', { role: 'alert' });
    const pass = h('input.input.lock-input#lock-pass', { type: 'password', autocomplete: 'current-password', 'aria-label': 'Passcode', placeholder: 'Passcode' });
    const btn = UI.btn('Unlock', null, { kind: 'primary', type: 'submit', id: 'unlock-btn' });
    const form = h(
      'form.lock-form',
      {
        onsubmit: async (e) => {
          e.preventDefault();
          if (btn.disabled) return;
          const v = pass.value;
          if (!v) return pass.focus();
          btn.disabled = true;
          err.textContent = '';
          btn.querySelector('span').textContent = 'Unlocking…';
          try {
            await D.unlock(v);
            App.failedAttempts = 0;
          } catch (ex) {
            App.failedAttempts++;
            pass.value = '';
            btn.querySelector('span').textContent = 'Unlock';
            if (App.failedAttempts >= 5) {
              err.textContent = 'That didn’t match. Take a breath and try again in 30 seconds.';
              setTimeout(() => {
                btn.disabled = false;
                err.textContent = '';
              }, 30000);
            } else {
              err.textContent = 'That passcode didn’t match. Try again.';
              btn.disabled = false;
              pass.focus();
            }
          }
        }
      },
      pass,
      btn,
      err
    );
    const recover = h('div.recover');
    const forgot = h(
      'button.link-btn',
      {
        type: 'button',
        onclick: () => {
          forgot.hidden = true;
          const code = h('input.input.lock-input#recovery-code', { type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'XXXX-XXXX-XXXX-XXXX', 'aria-label': 'Recovery code' });
          const rerr = h('p.form-error', { role: 'alert' });
          const rbtn = UI.btn('Use recovery code', null, { type: 'submit' });
          recover.appendChild(
            h(
              'form.lock-form',
              {
                onsubmit: async (e) => {
                  e.preventDefault();
                  rerr.textContent = '';
                  rbtn.disabled = true;
                  try {
                    await D.unlockWithRecovery(code.value);
                    newPasscodeAfterRecovery();
                  } catch (ex) {
                    rbtn.disabled = false;
                    rerr.textContent = 'That recovery code didn’t work. Check it and try again.';
                  }
                }
              },
              h('p.help', 'Enter the recovery code you saved when you turned on the lock.'),
              code,
              rbtn,
              rerr
            )
          );
          recover.appendChild(
            h(
              'p.small.muted',
              'No recovery code? Your entries can’t be opened without it, but you can ',
              h(
                'button.link-btn.inline',
                {
                  type: 'button',
                  onclick: async () => {
                    const ok = await UI.confirm({ title: 'Erase everything and start again?', body: 'Your locked entries will be permanently deleted. This can’t be undone.', confirm: 'Erase everything', danger: true, typed: 'ERASE' });
                    if (!ok) return;
                    await D.eraseAll();
                    for (const k of Object.keys(drafts)) delete drafts[k];
                    App.enter();
                  }
                },
                'erase everything and start again'
              ),
              '.'
            )
          );
          code.focus();
        }
      },
      'Forgot your passcode?'
    );
    main.appendChild(
      h(
        'div.lock-screen',
        h('div.lock-mark', UI.logo(72)),
        h('h1.lock-title', 'Lantern is locked'),
        h('p.muted', 'Enter your passcode to open your entries.'),
        form,
        forgot,
        recover,
        h('div.lock-support', h('p.small', 'Need someone to talk to right now?'), UI.btn('Support', supportSheet, { icon: 'support', small: true }))
      )
    );
    requestAnimationFrame(() => pass.focus({ preventScroll: true }));
  };

  function newPasscodeAfterRecovery() {
    const err = h('p.form-error', { role: 'alert' });
    const a = h('input.input#rec-new', { type: 'password', autocomplete: 'new-password', 'data-autofocus': '' });
    const b = h('input.input#rec-new2', { type: 'password', autocomplete: 'new-password' });
    const s = UI.sheet({
      title: 'Choose a new passcode',
      dismissible: false,
      body: h('div.form', h('p', 'You’re back in. Choose a new passcode now. Your recovery code will keep working.'), UI.field('New passcode', a, 'At least 4 characters.'), UI.field('Type it again', b), err),
      actions: [
        UI.btn('Save passcode', async () => {
          if (a.value.length < 4) return (err.textContent = 'Use at least 4 characters.');
          if (a.value !== b.value) return (err.textContent = 'Those two don’t match.');
          try {
            await D.changePasscode(a.value);
            s.close();
            UI.toast('New passcode saved.');
          } catch (e) {
            err.textContent = 'Couldn’t save it: ' + (e.message || e);
          }
        }, { kind: 'primary' })
      ]
    });
  }

  /* ---------- onboarding ---------- */
  V.welcome = {
    live: false,
    render(root) {
      const st = drafts.onb || (drafts.onb = { step: 0, name: '' });
      const card = h('div.welcome');
      root.appendChild(card);
      const finish = async () => {
        await D.updateProfile({ name: st.name.trim(), onboarded: true, startedAt: U.nowIso() });
        drafts.onb = null;
        R.go('today', null, { replace: true });
      };
      const next = () => {
        st.step++;
        App.render({ nav: true });
      };
      if (st.step === 0) {
        card.append(
          h('div.welcome-mark', UI.logo(96)),
          h('h1.welcome-title', 'Lantern'),
          h('p.welcome-lead', 'A quiet place to check in with yourself, write things down, and take small steps.'),
          h('ul.welcome-points', [
            ['today', 'Check in with how you’re feeling in a few seconds'],
            ['journal', 'Write freely, or use gentle prompts and CBT tools'],
            ['goals', 'Set small goals with no streaks to break'],
            ['insights', 'Notice what seems to help, over time']
          ].map(([ic, t]) => h('li', UI.icon(ic), h('span', t)))),
          h('div.actions.center', UI.btn('Get started', next, { kind: 'primary', id: 'onb-start' }), UI.btn('Look around with example data first', () => App.enterDemo(), { kind: 'ghost' }))
        );
      } else if (st.step === 1) {
        const input = h('input.input#onb-name', {
          type: 'text',
          maxlength: 40,
          autocomplete: 'given-name',
          placeholder: 'Your first name',
          value: st.name,
          oninput: (e) => (st.name = e.target.value),
          onkeydown: (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              next();
            }
          }
        });
        card.append(
          h('p.eyebrow', 'Step 1 of 3'),
          h('h1.welcome-title.small', 'What should Lantern call you?'),
          UI.field('', input, 'Optional. It’s only used to greet you.'),
          h('div.actions.center', UI.btn('Continue', next, { kind: 'primary', id: 'onb-next' }), UI.btn('Skip', () => {
            st.name = '';
            next();
          }, { kind: 'ghost' }))
        );
        requestAnimationFrame(() => {
          if (window.matchMedia('(pointer: fine)').matches) input.focus();
        });
      } else if (st.step === 2) {
        const text =
          App.mode === 'cloud'
            ? 'Your entries are saved to your claude.ai account in a private space only you can read, so Lantern works on your phone and computer. You can add a passcode, which also encrypts everything on your device before it’s saved.'
            : App.mode === 'memory'
              ? 'This browser isn’t letting Lantern save anything, so download a backup before closing the page.'
              : (L.env.standalone ? 'Your entries stay in this app on this device.' : 'Your entries stay in this browser on this device.') + ' Nothing is sent anywhere. You can add a passcode so nobody else who uses this device can read them.';
        const acts = h('div.actions.center');
        if (C.available() && App.mode !== 'memory') acts.appendChild(UI.btn('Set a passcode', () => V.setupLock(next), { kind: 'primary', icon: 'lock' }));
        acts.appendChild(UI.btn(C.available() && App.mode !== 'memory' ? 'Not now' : 'Continue', next, { kind: C.available() ? 'ghost' : 'primary' }));
        card.append(h('p.eyebrow', 'Step 2 of 3'), h('h1.welcome-title.small', 'Your privacy'), h('p.welcome-lead', text), h('p.muted', 'You can change this any time in Settings.'), acts);
      } else {
        card.append(
          h('p.eyebrow', 'Step 3 of 3'),
          h('h1.welcome-title.small', 'One more thing'),
          h('p.welcome-lead', 'Lantern is here alongside you, not instead of people who can help.'),
          h('p', 'If things ever feel like too much, tap ', h('strong', 'Support'), ' at the top of any page. It lists people you can talk to right now, day or night, and a place for your own safety plan.'),
          h('div.actions.center', UI.btn('Start using Lantern', finish, { kind: 'primary', id: 'onb-finish' }))
        );
      }
    }
  };

  /* ---------- storage choice ---------- */
  async function pickBackend() {
    if (L.env.artifact) {
      const cloud = await S.CloudBackend.connect();
      if (cloud) return { backend: cloud, mode: 'cloud' };
      App.cloudFallback = true;
    }
    return localBackend();
  }
  async function localBackend() {
    try {
      return { backend: await new S.IDBBackend().init(), mode: 'local' };
    } catch (e) {
      /* fall through */
    }
    try {
      return { backend: await new S.LSBackend().init(), mode: 'local' };
    } catch (e) {
      /* fall through */
    }
    return { backend: await new S.MemoryBackend().init(), mode: 'memory' };
  }

  /* ---------- example data ---------- */
  App.enterDemo = async () => {
    if (App.demo) return;
    App.flushDrafts();
    await D.chain;
    if (D.queue) await D.queue.idle();
    App.realBackend = D.backend;
    App.realLocked = false;
    App.demo = true;
    drafts.checkin = null;
    drafts.ack = null;
    await D.open(new S.MemoryBackend(L.demo.build()));
    R.stack = [];
    R.go('today', null, { replace: true });
    UI.toast('Example data loaded. Nothing you do here is saved.');
  };
  App.exitDemo = async () => {
    if (!App.demo) return;
    App.demo = false;
    drafts.checkin = null;
    drafts.ack = null;
    const r = await D.open(App.realBackend);
    App.realBackend = null;
    App.applyTheme(D.state.prefs.theme);
    if (r === 'locked') App.showLock();
    else App.enter();
  };

  /* ---------- enter the app ---------- */
  App.enter = () => {
    setChrome(true);
    App.els.lockBtn.hidden = !D.meta || App.demo;
    if (!D.profile().onboarded) {
      if (D.hasAnyData()) D.updateProfile({ onboarded: true });
      else {
        drafts.onb = drafts.onb || { step: 0, name: '' };
        R.current = { name: 'welcome', arg: null };
        R.stack = [];
      }
    }
    if (R.current.name === 'welcome' && D.profile().onboarded) R.current = { name: 'today', arg: null };
    App.render({ nav: true });
  };

  /* ---------- boot ---------- */
  App.boot = async () => {
    let cached = 'system';
    try {
      cached = localStorage.getItem('lantern.theme') || 'system';
    } catch (e) {
      /* optional */
    }
    App.applyTheme(cached);
    buildShell();
    setChrome(false);
    App.els.main.appendChild(h('div.loading', { role: 'status' }, h('div.loading-mark', UI.logo(64)), h('p', 'Opening Lantern…')));
    R.start();

    D.on((what, extra) => {
      if (what === 'status') return updateStatus(extra);
      if (what === 'write-error') {
        App.writeErrors++;
        App.scheduleRender();
        return;
      }
      if (what === 'locked') return App.showLock();
      if (what === 'unlocked') return App.enter();
      if (what === 'lock-required') {
        App.lock();
        return;
      }
      if (!App.started || D.locked) return;
      if (App.currentView && App.currentView.live === false) return;
      if (document.querySelector('.sheet-wrap')) {
        App._pendingRender = true;
        return;
      }
      App.scheduleRender();
    });

    let picked;
    try {
      picked = await pickBackend();
      App.mode = picked.mode;
      let r;
      try {
        r = await D.open(picked.backend);
      } catch (err) {
        if (picked.mode !== 'cloud') throw err;
        /* claude.ai storage refused (for example, access was declined): keep going in this browser. */
        console.warn('Lantern: claude.ai storage unavailable, using this browser instead', err);
        App.cloudFallback = true;
        picked = await localBackend();
        App.mode = picked.mode;
        r = await D.open(picked.backend);
      }
      App.started = true;
      App.applyTheme(D.state.prefs.theme);
      if (r === 'locked') App.showLock();
      else App.enter();
    } catch (e) {
      console.error(e);
      UI.clear(App.els.main);
      App.els.main.appendChild(
        h('div.lock-screen', h('div.lock-mark', UI.logo(64)), h('h1.lock-title', 'Lantern couldn’t open'), h('p', 'Something stopped Lantern from reading its storage. Try reloading the page.'), h('pre.error-text', String((e && e.message) || e)))
      );
      return;
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        App.hiddenAt = Date.now();
        App.flushDrafts();
      } else if (D.meta && !D.locked && !App.demo && App.hiddenAt) {
        const mins = Number(D.state.prefs.autoLock);
        if (mins > 0 && Date.now() - App.hiddenAt > mins * 60000) App.lock();
      }
    });
    window.addEventListener('pagehide', () => App.flushDrafts());
    window.addEventListener('beforeunload', (e) => {
      App.flushDrafts();
      if (D.queue && D.queue.busy() && !App.demo) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
    /* A re-render that waited for a dialog to close. */
    new MutationObserver(() => {
      if (App._pendingRender && !document.querySelector('.sheet-wrap')) {
        App._pendingRender = false;
        App.scheduleRender();
      }
    }).observe(document.getElementById('layer'), { childList: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => App.boot());
  else App.boot();
})((window.Lantern = window.Lantern || {}));
