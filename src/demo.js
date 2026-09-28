/* Lantern — example data for "look around first". Built in memory only; never saved. */
(function (L) {
  'use strict';
  const U = L.util;
  const S = L.store;

  function rng(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Returns raw documents, in the same shape the storage layer writes. */
  L.demo = {
    build() {
      const rand = rng(20260924);
      const pick = (arr) => arr[Math.floor(rand() * arr.length)];
      const docs = {};
      const addBucket = (coll, rec) => {
        const key = S.bucketFor(coll, rec);
        (docs[key] = docs[key] || { items: {} }).items[rec.id] = JSON.stringify(rec);
      };
      const addDoc = (coll, rec) => {
        docs[S.COLLS[coll].prefix + '.' + rec.id] = { p: JSON.stringify(rec) };
      };
      const at = (daysAgo, hour, min) => {
        const d = U.addDays(new Date(), -daysAgo);
        d.setHours(hour, min || 0, 0, 0);
        return d;
      };

      const DAYS = 45;
      for (let i = DAYS; i >= 0; i--) {
        if (rand() < 0.14 && i > 0) continue;
        const outside = rand() < 0.45;
        const exercise = rand() < 0.25;
        const people = rand() < 0.35;
        const alcohol = rand() < 0.15;
        const screens = rand() < 0.3;
        const sleep = Math.round((5.5 + rand() * 3.5) * 2) / 2;
        let m = 2.1 + ((DAYS - i) / DAYS) * 1.2 + (rand() - 0.5) * 1.4;
        if (outside) m += 0.5;
        if (exercise) m += 0.35;
        if (people) m += 0.4;
        if (alcohol) m -= 0.5;
        if (screens) m -= 0.3;
        if (sleep >= 7) m += 0.3;
        const mood = U.clamp(Math.round(m), 1, 5);
        const acts = [];
        if (outside) acts.push('Got outside');
        if (exercise) acts.push('Exercise');
        if (people) acts.push(rand() < 0.5 ? 'Saw people' : 'Talked to someone');
        if (alcohol) acts.push('Alcohol');
        if (screens) acts.push('Lots of screen time');
        if (rand() < 0.4) acts.push('Work or study');
        if (rand() < 0.5) acts.push('Took medication');
        const heavy = ['Tired', 'Anxious', 'Sad', 'Numb', 'Overwhelmed', 'Lonely', 'Exhausted'];
        const light = ['Calm', 'Content', 'Hopeful', 'Grateful', 'Relieved', 'Connected'];
        const emos = new Set();
        const n = 1 + Math.floor(rand() * 2);
        for (let k = 0; k < n; k++) emos.add(mood <= 2 ? pick(heavy.slice(1)) : mood >= 4 ? pick(light) : pick(rand() < 0.5 ? heavy.slice(1) : light));
        const ts = at(i, 9 + Math.floor(rand() * 11), Math.floor(rand() * 60));
        addBucket('checkins', {
          id: U.uid(),
          created: ts.toISOString(),
          updated: ts.toISOString(),
          ts: ts.toISOString(),
          mood,
          emotions: [...emos],
          activities: acts,
          sleep,
          energy: U.clamp(mood + (rand() < 0.5 ? -1 : 0), 1, 5),
          note: ''
        });
      }

      const journal = [
        { d: 40, tpl: 'free', title: 'Starting somewhere', fields: { body: 'My GP suggested writing things down. I don’t really know what to say, but today was long and I didn’t leave the house. Writing that down feels like something.' }, mood: 2 },
        { d: 33, tpl: 'thought', fields: { situation: 'A friend didn’t reply to my message all day.', thought: 'They’re sick of me. Everyone is.', feelings: 'Sad, ashamed', before: 80, traps: ['Mind reading', 'Overgeneralising'], for: 'They have been quieter lately.', against: 'They were at work. Last week they asked to meet up. They replied in the evening with a long message.', balanced: 'People get busy. A slow reply isn’t proof that someone is sick of me.', after: 40 }, mood: 2 },
        { d: 26, tpl: 'good3', fields: { g1: 'Sat in the garden with a coffee. The sun came out for a bit.', g2: 'Rang my sister. We laughed about something from when we were kids.', g3: 'Cooked a proper dinner instead of toast.' }, mood: 3 },
        { d: 18, tpl: 'evening', fields: { well: 'Went for a short walk after lunch.', hard: 'The morning. Everything felt heavy until about 11.', did: 'Replied to two emails I’d been avoiding.', tomorrow: 'Get outside earlier. Be gentle if the morning is slow again.' }, mood: 3 },
        { d: 9, tpl: 'compassion', fields: { hard: 'I cancelled plans again and feel guilty.', common: 'Lots of people have to cancel when they’re unwell.', friend: 'You’re doing what you can. They’ll understand, and there’ll be another time.', need: 'Rest, and to message them to rearrange.' }, mood: 2 },
        { d: 2, tpl: 'free', title: 'A better week', fields: { body: 'Three walks this week and I saw Sam on Saturday. Still tired a lot, but the mornings are a little easier.\n\nI want to remember that this helped.' }, mood: 4 }
      ];
      for (const j of journal) {
        const ts = at(j.d, 20, 15).toISOString();
        addDoc('journal', { id: U.uid(), created: ts, updated: ts, ts, template: j.tpl, title: j.title || '', fields: j.fields, mood: j.mood });
      }

      const walkLog = [];
      for (let i = 20; i >= 0; i--) if (rand() < 0.45) walkLog.push(U.dayKey(U.addDays(new Date(), -i)));
      const g1 = at(24, 10).toISOString();
      addDoc('goals', { id: U.uid(), created: g1, updated: g1, kind: 'habit', title: 'A short walk', why: 'I feel a bit clearer afterwards, even when I don’t want to go.', area: 'Health and body', status: 'active', perWeek: 3, log: walkLog, steps: [], target: null });
      const g2 = at(14, 11).toISOString();
      addDoc('goals', {
        id: U.uid(),
        created: g2,
        updated: g2,
        kind: 'steps',
        title: 'Sort out the spare room',
        why: 'So it can be a calm space again.',
        area: 'Home',
        status: 'active',
        target: U.dayKey(U.addDays(new Date(), 12)),
        perWeek: null,
        log: [],
        steps: [
          { id: U.uid(), text: 'Clear the desk', done: true, doneAt: at(10, 15).toISOString() },
          { id: U.uid(), text: 'Take the old boxes to the tip', done: true, doneAt: at(4, 12).toISOString() },
          { id: U.uid(), text: 'Put the books back on the shelf', done: false, doneAt: null },
          { id: U.uid(), text: 'Hang the picture', done: false, doneAt: null }
        ]
      });
      const g3 = at(30, 9).toISOString();
      addDoc('goals', { id: U.uid(), created: g3, updated: at(12, 9).toISOString(), kind: 'steps', title: 'Book a GP appointment', why: 'To talk about how I’ve been feeling.', area: 'Health and body', status: 'done', doneAt: at(12, 9).toISOString(), perWeek: null, log: [], target: null, steps: [{ id: U.uid(), text: 'Ring the surgery at 8am', done: true, doneAt: at(12, 8).toISOString() }] });

      const wins = ['Got up and showered', 'Replied to that email', 'Went to the shop', 'Called my sister', 'Cooked dinner', 'Made my bed', 'Walked to the park', 'Watered the plants'];
      wins.forEach((t, i) => {
        const ts = at(38 - i * 5, 18, 30).toISOString();
        addBucket('wins', { id: U.uid(), created: ts, updated: ts, ts, text: t, source: 'manual' });
      });

      [[42, [3, 3, 2, 3, 1, 2, 2, 1, 0]], [28, [2, 2, 2, 3, 1, 2, 1, 1, 0]], [14, [2, 1, 2, 2, 1, 1, 1, 0, 0]], [1, [1, 1, 1, 2, 1, 1, 1, 0, 0]]].forEach(([d, answers]) => {
        const ts = at(d, 19).toISOString();
        addBucket('tests', { id: U.uid(), created: ts, updated: ts, ts, type: 'phq9', answers, score: answers.reduce((a, b) => a + b, 0), difficulty: 1 });
      });

      docs.profile = { p: JSON.stringify({ name: '', onboarded: true, customEmotions: [], customActivities: [], dismissed: {} }) };
      return docs;
    }
  };
})((window.Lantern = window.Lantern || {}));
