/* Lantern — core utilities and content. */
(function (L) {
  'use strict';

  /* ---------- utilities ---------- */
  const U = (L.util = {});

  U.uid = () => {
    const b = crypto.getRandomValues(new Uint8Array(12));
    let s = '';
    for (const x of b) s += (x % 36).toString(36);
    return s;
  };
  U.nowIso = () => new Date().toISOString();
  U.pad2 = (n) => String(n).padStart(2, '0');
  U.toDate = (d) => (d instanceof Date ? d : new Date(d));
  U.dayKey = (d) => {
    d = U.toDate(d);
    return d.getFullYear() + '-' + U.pad2(d.getMonth() + 1) + '-' + U.pad2(d.getDate());
  };
  U.todayKey = () => U.dayKey(new Date());
  U.parseDay = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  U.addDays = (date, n) => {
    const d = new Date(U.toDate(date).getTime());
    d.setDate(d.getDate() + n);
    return d;
  };
  U.dayDiff = (aKey, bKey) => Math.round((U.parseDay(bKey) - U.parseDay(aKey)) / 86400000);
  U.mondayOf = (date) => {
    const d = new Date(U.toDate(date).getTime());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  };
  U.monthKey = (d) => {
    d = U.toDate(d);
    return d.getFullYear() + '-' + U.pad2(d.getMonth() + 1);
  };
  const fmt = (opts) => new Intl.DateTimeFormat('en-GB', opts);
  const F = {
    long: fmt({ weekday: 'long', day: 'numeric', month: 'long' }),
    longYear: fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    short: fmt({ weekday: 'short', day: 'numeric', month: 'short' }),
    dayMonth: fmt({ day: 'numeric', month: 'short' }),
    dayMonthYear: fmt({ day: 'numeric', month: 'short', year: 'numeric' }),
    monthYear: fmt({ month: 'long', year: 'numeric' }),
    month: fmt({ month: 'short' }),
    monthLong: fmt({ month: 'long' }),
    weekday: fmt({ weekday: 'short' }),
    weekdayLong: fmt({ weekday: 'long' }),
    time: fmt({ hour: '2-digit', minute: '2-digit' })
  };
  U.fmtLong = (d) => F.long.format(U.toDate(d));
  U.fmtLongYear = (d) => F.longYear.format(U.toDate(d));
  U.fmtShort = (d) => F.short.format(U.toDate(d));
  U.fmtDayMonth = (d) => F.dayMonth.format(U.toDate(d));
  U.fmtDayMonthYear = (d) => F.dayMonthYear.format(U.toDate(d));
  U.fmtMonthYear = (d) => F.monthYear.format(U.toDate(d));
  U.fmtMonth = (d) => F.month.format(U.toDate(d));
  U.fmtMonthLong = (d) => F.monthLong.format(U.toDate(d));
  U.fmtWeekday = (d) => F.weekday.format(U.toDate(d));
  U.fmtWeekdayLong = (d) => F.weekdayLong.format(U.toDate(d));
  U.fmtTime = (d) => F.time.format(U.toDate(d));
  U.relDay = (d) => {
    const key = U.dayKey(d);
    const diff = U.dayDiff(key, U.todayKey());
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff > 1 && diff < 7) return U.fmtWeekdayLong(d);
    const sameYear = U.toDate(d).getFullYear() === new Date().getFullYear();
    return sameYear ? U.fmtShort(d) : U.fmtDayMonthYear(d);
  };
  U.greeting = (d = new Date()) => {
    const h = d.getHours();
    if (h >= 5 && h < 12) return 'Good morning';
    if (h >= 12 && h < 17) return 'Good afternoon';
    if (h >= 17 && h < 23) return 'Good evening';
    return 'Hello';
  };
  /* Local "YYYY-MM-DDTHH:MM" for datetime-local inputs, and back. */
  U.toLocalInput = (d) => {
    d = U.toDate(d);
    return U.dayKey(d) + 'T' + U.pad2(d.getHours()) + ':' + U.pad2(d.getMinutes());
  };
  U.fromLocalInput = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || '');
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  };

  U.avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  U.round1 = (x) => Math.round(x * 10) / 10;
  U.clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  U.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  U.clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
  U.plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
  U.isBlank = (s) => !s || !String(s).trim();
  U.hashStr = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  U.pickDaily = (arr, salt, offset = 0) => arr[(U.hashStr(U.todayKey() + '|' + salt) + offset) % arr.length];
  U.debounce = (fn, ms) => {
    let t = null;
    let lastArgs = [];
    const d = (...args) => {
      lastArgs = args;
      clearTimeout(t);
      t = setTimeout(() => {
        t = null;
        fn(...lastArgs);
      }, ms);
    };
    d.flush = () => {
      if (t) {
        clearTimeout(t);
        t = null;
        fn(...lastArgs);
      }
    };
    d.cancel = () => {
      clearTimeout(t);
      t = null;
    };
    d.pending = () => t !== null;
    return d;
  };
  U.byDesc = (f) => (a, b) => (f(a) < f(b) ? 1 : f(a) > f(b) ? -1 : 0);
  U.byAsc = (f) => (a, b) => (f(a) > f(b) ? 1 : f(a) < f(b) ? -1 : 0);
  U.words = (s) => (String(s || '').trim().match(/\S+/g) || []).length;

  /* ---------- content ---------- */
  const K = (L.content = {});

  K.APP_NAME = 'Lantern';
  K.VERSION = '1.1.0';

  K.MOODS = [
    { v: 1, label: 'Very low' },
    { v: 2, label: 'Low' },
    { v: 3, label: 'Okay' },
    { v: 4, label: 'Good' },
    { v: 5, label: 'Great' }
  ];
  K.moodLabel = (v) => (v ? K.MOODS[U.clamp(Math.round(v), 1, 5) - 1].label : '');
  K.moodVar = (v) => 'var(--m' + U.clamp(Math.round(v), 1, 5) + ')';

  K.EMOTIONS = [
    { t: 'Sad', g: 'heavy' },
    { t: 'Anxious', g: 'heavy' },
    { t: 'Numb', g: 'heavy' },
    { t: 'Exhausted', g: 'heavy' },
    { t: 'Irritable', g: 'heavy' },
    { t: 'Lonely', g: 'heavy' },
    { t: 'Overwhelmed', g: 'heavy' },
    { t: 'Hopeless', g: 'heavy' },
    { t: 'Calm', g: 'steady' },
    { t: 'Content', g: 'steady' },
    { t: 'Relieved', g: 'steady' },
    { t: 'Hopeful', g: 'light' },
    { t: 'Grateful', g: 'light' },
    { t: 'Proud', g: 'light' },
    { t: 'Connected', g: 'light' },
    { t: 'Motivated', g: 'light' }
  ];

  K.ACTIVITIES = [
    'Got outside',
    'Exercise',
    'Saw people',
    'Talked to someone',
    'Work or study',
    'Hobby',
    'Chores',
    'Self-care',
    'Ate well',
    'Rested',
    'Took medication',
    'Therapy',
    'Alcohol',
    'Lots of screen time'
  ];

  K.SMALL_STEPS = [
    { k: 'Body', t: 'Drink a glass of water' },
    { k: 'Body', t: 'Open a window and take a few breaths of fresh air' },
    { k: 'Body', t: 'Step outside for five minutes' },
    { k: 'Body', t: 'Stretch for two minutes' },
    { k: 'Body', t: 'Have a shower, or just wash your face' },
    { k: 'Body', t: 'Eat something, even something small' },
    { k: 'Body', t: 'Walk to the end of the road and back' },
    { k: 'Getting things done', t: 'Clear one small surface' },
    { k: 'Getting things done', t: 'Wash five things in the sink' },
    { k: 'Getting things done', t: 'Reply to one message' },
    { k: 'Getting things done', t: 'Make your bed' },
    { k: 'Getting things done', t: 'Put one load of washing on' },
    { k: 'Getting things done', t: 'Throw away three things you don’t need' },
    { k: 'People', t: 'Text someone “thinking of you”' },
    { k: 'People', t: 'Send a friend a photo or a song' },
    { k: 'People', t: 'Say hello to a neighbour or someone in a shop' },
    { k: 'People', t: 'Call someone for five minutes' },
    { k: 'Enjoyment', t: 'Listen to a song you love, all the way through' },
    { k: 'Enjoyment', t: 'Make a hot drink and sit with it' },
    { k: 'Enjoyment', t: 'Look through photos that make you smile' },
    { k: 'Enjoyment', t: 'Read one page of something' },
    { k: 'Enjoyment', t: 'Watch the sky for a minute' },
    { k: 'Enjoyment', t: 'Doodle for five minutes' },
    { k: 'Mind', t: 'Write down one thing you’re looking forward to' },
    { k: 'Mind', t: 'Take one minute of slow breathing' },
    { k: 'Mind', t: 'Name three things you can see right now' }
  ];

  K.PROMPTS = [
    'What’s one thing that went okay today, even slightly?',
    'What’s taking up the most space in your head right now?',
    'What would you say to a friend who felt the way you feel today?',
    'What’s something small you’re looking forward to?',
    'When did you feel most like yourself this week?',
    'What drained your energy today, and what gave a little back?',
    'What did you do today that took effort, even if no one saw it?',
    'What do you need more of right now? What do you need less of?',
    'Describe a place where you feel safe or calm.',
    'What’s a worry you could set down for tonight?',
    'Who or what helped you recently, even in a small way?',
    'What’s something you’ve got through before that felt impossible at the time?',
    'If today had a weather forecast, what would it be? What might change it?',
    'What are three things your body did for you today?',
    'What’s one kind thing you could do for yourself tomorrow?'
  ];

  K.TRAPS = [
    { t: 'All-or-nothing', d: 'If it isn’t perfect, it’s a failure.' },
    { t: 'Catastrophising', d: 'Jumping to the worst possible outcome.' },
    { t: 'Mind reading', d: 'Assuming you know what others think of you.' },
    { t: 'Fortune telling', d: 'Predicting that things will go badly.' },
    { t: 'Overgeneralising', d: 'One bad thing means everything is bad. “Always”, “never”.' },
    { t: 'Labelling', d: 'Calling yourself names like “useless”.' },
    { t: '“Should” statements', d: 'Rigid rules about how you ought to be.' },
    { t: 'Discounting the good', d: 'Brushing off good things as luck or not counting.' },
    { t: 'Emotional reasoning', d: 'I feel it, so it must be true.' },
    { t: 'Blaming yourself', d: 'Taking responsibility for things outside your control.' }
  ];

  K.TEMPLATES = [
    {
      id: 'free',
      name: 'Free write',
      blurb: 'Write whatever is on your mind. No rules.',
      fields: [{ k: 'body', type: 'long', label: '', placeholder: 'Start anywhere…', rows: 10 }]
    },
    {
      id: 'good3',
      name: 'Three good things',
      blurb: 'Notice what went well today, however small, and why it happened.',
      fields: [
        { k: 'g1', type: 'long', label: 'Good thing one', placeholder: 'What went well? Why do you think it happened?', rows: 2 },
        { k: 'g2', type: 'long', label: 'Good thing two', placeholder: 'It can be tiny. A warm drink counts.', rows: 2 },
        { k: 'g3', type: 'long', label: 'Good thing three', placeholder: 'Anything else, however small?', rows: 2 }
      ]
    },
    {
      id: 'thought',
      name: 'Thought record',
      blurb: 'Untangle a painful thought step by step. A core tool from CBT.',
      fields: [
        { k: 'situation', type: 'long', label: 'What happened?', help: 'Where were you, who was there, what was going on?', rows: 3 },
        { k: 'thought', type: 'long', label: 'What went through your mind?', help: 'The thought that hurt most, written the way it sounded in your head.', rows: 3 },
        { k: 'feelings', type: 'text', label: 'What did you feel?', placeholder: 'For example: ashamed, sad, tense' },
        { k: 'before', type: 'scale', label: 'How strong was that feeling?', min: 0, max: 100, step: 5, unit: '%' },
        { k: 'traps', type: 'chips', label: 'Any thinking traps?', help: 'Tap any that fit. It’s fine if none do.', options: K.TRAPS.map((x) => x.t) },
        { k: 'for', type: 'long', label: 'What supports the thought?', rows: 3 },
        { k: 'against', type: 'long', label: 'What doesn’t fit the thought?', help: 'What would you say to a friend? Is there anything you’ve overlooked?', rows: 3 },
        { k: 'balanced', type: 'long', label: 'A more balanced way to see it', rows: 3 },
        { k: 'after', type: 'scale', label: 'How strong is the feeling now?', min: 0, max: 100, step: 5, unit: '%' }
      ]
    },
    {
      id: 'compassion',
      name: 'Self-compassion',
      blurb: 'Speak to yourself the way you would to a good friend.',
      fields: [
        { k: 'hard', type: 'long', label: 'What’s hard right now?', rows: 3 },
        { k: 'common', type: 'long', label: 'Who else might feel this way?', help: 'Struggling is part of being human. It isn’t a sign that you’ve failed.', rows: 2 },
        { k: 'friend', type: 'long', label: 'What would you say to a friend in your place?', rows: 3 },
        { k: 'need', type: 'long', label: 'What do you need right now?', rows: 2 }
      ]
    },
    {
      id: 'worry',
      name: 'Worry dump',
      blurb: 'Get the worries out of your head and onto the page.',
      fields: [
        { k: 'worries', type: 'long', label: 'What’s worrying you?', placeholder: 'List everything, big or small.', rows: 5 },
        { k: 'control', type: 'long', label: 'Which parts can you do something about?', rows: 3 },
        { k: 'next', type: 'text', label: 'One small next step', placeholder: 'Something you could do in ten minutes or less' },
        { k: 'letgo', type: 'long', label: 'What can you set down for now?', rows: 2 }
      ]
    },
    {
      id: 'evening',
      name: 'Evening reflection',
      blurb: 'Close the day gently.',
      fields: [
        { k: 'well', type: 'long', label: 'What went okay today?', rows: 2 },
        { k: 'hard', type: 'long', label: 'What was hard?', rows: 2 },
        { k: 'did', type: 'long', label: 'Something you did, however small', rows: 2 },
        { k: 'tomorrow', type: 'long', label: 'What do you need tomorrow?', rows: 2 }
      ]
    }
  ];
  K.template = (id) => K.TEMPLATES.find((t) => t.id === id) || K.TEMPLATES[0];

  K.AREAS = ['Health and body', 'Mind', 'People', 'Home', 'Work and study', 'Fun and creativity', 'Growth'];

  /* PHQ-9: developed by Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and colleagues,
     with an educational grant from Pfizer Inc. No permission required to reproduce. */
  K.PHQ9 = {
    stem: 'Over the last 2 weeks, how often have you been bothered by any of the following problems?',
    items: [
      'Little interest or pleasure in doing things',
      'Feeling down, depressed, or hopeless',
      'Trouble falling or staying asleep, or sleeping too much',
      'Feeling tired or having little energy',
      'Poor appetite or overeating',
      'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
      'Trouble concentrating on things, such as reading the newspaper or watching television',
      'Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
      'Thoughts that you would be better off dead or of hurting yourself in some way'
    ],
    options: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'],
    difficulty: {
      q: 'If you checked off any problems, how difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?',
      options: ['Not difficult at all', 'Somewhat difficult', 'Very difficult', 'Extremely difficult']
    },
    bands: [
      { min: 0, max: 4, label: 'Minimal' },
      { min: 5, max: 9, label: 'Mild' },
      { min: 10, max: 14, label: 'Moderate' },
      { min: 15, max: 19, label: 'Moderately severe' },
      { min: 20, max: 27, label: 'Severe' }
    ],
    credit:
      'PHQ-9 developed by Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and colleagues, with an educational grant from Pfizer Inc. No permission required to reproduce.'
  };
  K.phqBand = (score) => K.PHQ9.bands.find((b) => score >= b.min && score <= b.max) || K.PHQ9.bands[0];

  /* Verified 24 September 2026. Papyrus HOPELINE247 closed on 7 September 2026 and is deliberately absent. */
  K.HELPLINES = [
    { name: 'Samaritans', detail: 'Free, any time, day or night. Talk about anything.', display: '116 123', tel: '116123', url: 'https://www.samaritans.org', kind: 'call' },
    { name: 'Shout', detail: 'Free text support, any time. Text the word SHOUT.', display: 'Text SHOUT to 85258', copy: '85258', sms: '85258', body: 'SHOUT', url: 'https://giveusashout.org', kind: 'text' },
    { name: 'NHS 111, option 2', detail: 'Urgent mental health help from the NHS, 24 hours a day (England).', display: '111, then option 2', copy: '111', tel: '111', url: 'https://111.nhs.uk', kind: 'call' },
    { name: 'CALM', detail: 'Free, 5pm to midnight every day. Phone or webchat.', display: '0800 58 58 58', tel: '0800585858', url: 'https://www.thecalmzone.net', kind: 'call' }
  ];
  K.INFO_LINES = [
    {
      name: 'NHS Talking Therapies',
      detail: 'Free NHS therapy for depression and anxiety. In England you can refer yourself without seeing your GP.',
      url: 'https://www.nhs.uk/nhs-services/mental-health-services/find-nhs-talking-therapies-for-anxiety-and-depression/',
      linkText: 'Find your local service'
    },
    { name: 'Mind Infoline', detail: 'Information about support and services, weekdays 9am to 6pm. Not a crisis line.', display: '0300 123 3393', tel: '03001233393', url: 'https://www.mind.org.uk', kind: 'call' },
    { name: 'Your GP', detail: 'Your GP can talk through how you’re feeling, review treatment and refer you on.' }
  ];

  K.SAFETY_SECTIONS = [
    { k: 'warning', title: 'Warning signs', help: 'Thoughts, feelings or situations that tell me things are getting worse.', ph: 'For example: I stop replying to messages' },
    { k: 'coping', title: 'Things I can do on my own', help: 'To take my mind off things or feel a little calmer.', ph: 'For example: a hot shower, a walk round the block' },
    { k: 'places', title: 'People and places that help me feel better', help: 'For company or a change of scene, without having to talk about how I feel.', ph: 'For example: the library, my sister’s house' },
    { k: 'people', title: 'People I can ask for help', help: 'Someone I trust to talk to when things are hard.', person: true },
    { k: 'pros', title: 'Professionals and services', help: 'My GP, therapist, crisis team or a helpline.', person: true },
    { k: 'safer', title: 'Making where I am safer', help: 'Things I can do to keep myself safe when I feel at risk.', ph: 'For example: ask someone to hold on to my medication' },
    { k: 'reasons', title: 'Reasons to keep going', help: 'People, plans and things that matter to me.', ph: 'For example: my dog, seeing the sea again' }
  ];

  K.ACKS = {
    1: { title: 'Thank you for checking in.', body: 'That sounds really hard. You don’t have to fix anything right now. Would one of these help?' },
    2: { title: 'Thanks for being honest with yourself.', body: 'Low days count too. Is there one small thing that might help a little?' },
    3: { title: 'Logged.', body: 'Okay is a perfectly fine place to be.' },
    4: { title: 'Glad to hear it.', body: 'What’s helping? It’s worth remembering for harder days.' },
    5: { title: 'That’s lovely to hear.', body: 'What’s helping? It’s worth remembering for harder days.' }
  };
})((window.Lantern = window.Lantern || {}));
