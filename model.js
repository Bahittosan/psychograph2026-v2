/*
 * Психометрика — учебная модель, версия 1.0.0.
 * ШАМ-Ш: восемь отдельных средних по четырём ответам (1–5).
 * Формулы simulateDay — авторские правила игры, не психометрическая методика,
 * не оценка эффективности восстановления и не психологический прогноз.
 * Все встроенные профили и персонажи вымышлены.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PsyModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '1.0.0';
  const MAX_ROWS = 1000;
  const MAX_CSV_BYTES = 1000000;
  const DAYS = 4;
  const HOURS = 6;

  const SCALES = [
    { id: 'curiosity', short: 'Познание', label: 'Познавательная мотивация', description: 'Интерес к новому и удовольствие от понимания изучаемого.', items: [1, 9, 17, 25] },
    { id: 'achievement', short: 'Достижение', label: 'Мотивация достижения', description: 'Удовольствие от сложных задач и интеллектуальных усилий.', items: [2, 10, 18, 26] },
    { id: 'growth', short: 'Развитие', label: 'Мотивация саморазвития', description: 'Стремление развивать способности и совершенствовать мастерство.', items: [3, 11, 19, 27] },
    { id: 'selfRespect', short: 'Самоуважение', label: 'Мотивация самоуважения', description: 'Учёба как способ подтвердить собственную значимость и способности.', items: [4, 12, 20, 28] },
    { id: 'guilt', short: 'Долг и вина', label: 'Интроецированная мотивация', description: 'Учёба из чувства долга, стыда или вины.', items: [5, 13, 21, 29] },
    { id: 'approval', short: 'Одобрение', label: 'Позитивные экстернальные мотивы', description: 'Стремление заслужить уважение и принятие со стороны родителей.', items: [6, 14, 22, 30] },
    { id: 'avoidance', short: 'Избегание', label: 'Негативные экстернальные мотивы', description: 'Вынужденность учёбы и стремление избежать проблем.', items: [7, 15, 23, 31] },
    { id: 'amotivation', short: 'Амотивация', label: 'Амотивация', description: 'Недостаток интереса и ощущение утраты смысла учебной деятельности.', items: [8, 16, 24, 32] }
  ];

  const DEMO_PROFILES = [
    { id: 'p01', name: 'Профиль А', context: 'Интерес и усталость', scores: [4.5, 4.25, 4.5, 3.5, 3, 2.25, 2.5, 1.25], synthetic: true },
    { id: 'p02', name: 'Профиль Б', context: 'Учёба ради оценки', scores: [3, 3.25, 3, 4.25, 4.5, 4.75, 4.5, 2.5], synthetic: true },
    { id: 'p03', name: 'Профиль В', context: 'Потерянный смысл', scores: [2, 2.25, 2.5, 2.75, 3, 2.75, 3.75, 4.25], synthetic: true }
  ];

  const CASES = [
    {
      id: 'spark', title: 'Хочу, но не вывожу', kicker: 'Интерес есть. Ресурсов пока нет.',
      story: 'До зачёта четыре дня. Предмет интересен, но материалы не собраны, план неясен, а запас энергии уже наполовину исчерпан. Распредели по шесть часов в день между учёбой, восстановлением и поиском поддержки.',
      profileId: 'p01', initial: { energy: 50, resources: 0, progress: 0 }, goal: 60, interest: 87.5,
      question: 'Почему сильного интереса недостаточно для успешного прохождения?',
      answers: [
        { text: 'Интерес и доступные условия — разные части ситуации.', correct: true, explanation: 'В этой игре интерес фиксирован, а энергия и ресурсы меняются отдельно. Даже высокое желание учиться не создаёт автоматически время, помощь и материалы.' },
        { text: 'При высоком интересе отдых можно полностью исключить.', correct: false, explanation: 'По правилам игры учёба расходует энергию. Если её не восстанавливать, итоговый план может не пройти даже при достаточном прогрессе.' },
        { text: 'Низкая энергия означает низкую познавательную мотивацию.', correct: false, explanation: 'Это разные величины. Познавательная мотивация относится к причинам учиться; энергия в игре — отдельное условное состояние.' }
      ]
    },
    {
      id: 'pressure', title: 'Всё ради оценки', kicker: 'Много требований. Нужен устойчивый план.',
      story: 'Герой беспокоится об оценках и ожиданиях близких. Энергии достаточно, но есть соблазн потратить всё время на учёбу. Помоги дойти до зачёта и сохранить запас для следующего дня.',
      profileId: 'p02', initial: { energy: 70, resources: 25, progress: 0 }, goal: 65, interest: 50,
      question: 'Что можно заключить по высокому баллу внешней мотивации?',
      answers: [
        { text: 'В ответах заметную роль играют внешние причины учиться.', correct: true, explanation: 'Отдельная шкала описывает выраженность конкретных мотивов. Она не доказывает лень, диагноз, способности или будущую успеваемость.' },
        { text: 'Человек обязательно будет учиться хуже остальных.', correct: false, explanation: 'Один профиль не позволяет предсказать результат конкретного человека. Успех зависит от многих условий, а игра лишь иллюстрирует выбранные правила.' },
        { text: 'Все высокие баллы нужно увеличить до максимума.', correct: false, explanation: 'Шкалы описывают разные причины учёбы, а не восемь взаимозаменяемых показателей успеха. Максимум по каждой шкале не является целью методики.' }
      ]
    },
    {
      id: 'meaning', title: 'Зачем я это делаю?', kicker: 'Материалы есть. Интереса меньше.',
      story: 'Материалы и помощь доступны, но смысл предмета пока неясен. В этой короткой игре интерес остаётся постоянным: найди выполнимый ритм и проверь, как условия помогают выполнить конкретную задачу.',
      profileId: 'p03', initial: { energy: 55, resources: 45, progress: 0 }, goal: 55, interest: 25,
      question: 'Можно ли по высокому баллу амотивации поставить диагноз?',
      answers: [
        { text: 'Нет. Это повод уточнять учебную ситуацию, а не ставить диагноз.', correct: true, explanation: 'Шкала описывает ответы о смысле и интересе к учебной деятельности. Ни один результат этой учебной лаборатории не является клинической оценкой.' },
        { text: 'Да, если перевести балл в шкалу от 0 до 100.', correct: false, explanation: 'Линейный пересчёт меняет только единицу отображения. Он не добавляет диагностической точности, норм или новых признаков.' },
        { text: 'Да, если линия на графике выше остальных.', correct: false, explanation: 'График помогает сравнить значения, но форма линии сама по себе не является клиническим критерием.' }
      ]
    }
  ];

  function finiteNumber(value, label, min, max) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      throw new Error(label + ': ожидается число от ' + min + ' до ' + max + '.');
    }
    return value;
  }

  function normalize(mean) {
    return 25 * (finiteNumber(mean, 'Средний балл', 1, 5) - 1);
  }

  function scoreAnswers(answers) {
    if (!Array.isArray(answers) || answers.length !== 32) {
      throw new Error('Нужны ровно 32 ответа ШАМ-Ш.');
    }
    answers.forEach(function (value, index) {
      finiteNumber(value, 'Ответ ' + (index + 1), 1, 5);
      if (!Number.isInteger(value)) throw new Error('Ответ ' + (index + 1) + ': выбери целое число от 1 до 5.');
    });
    return SCALES.map(function (scale) {
      return scale.items.reduce(function (sum, question) { return sum + answers[question - 1]; }, 0) / 4;
    });
  }

  function validId(value, line) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_][A-Za-z0-9_-]{0,31}$/.test(value)) {
      throw new Error((line ? 'Строка ' + line + ': ' : '') + 'id должен содержать 1–32 латинские буквы, цифры, _ или -. Первый знак — буква, цифра или _. Используй анонимный код.');
    }
    return value;
  }

  function detectDelimiter(text) {
    const counts = { ';': 0, ',': 0, '\t': 0 };
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const ch = text[index];
      if (ch === '"') {
        if (quoted && text[index + 1] === '"') { index += 1; continue; }
        quoted = !quoted;
      } else if (!quoted && (ch === '\n' || ch === '\r')) {
        break;
      } else if (!quoted && Object.prototype.hasOwnProperty.call(counts, ch)) {
        counts[ch] += 1;
      }
    }
    if (quoted) throw new Error('В заголовке CSV не закрыты кавычки.');
    const delimiter = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    if (!counts[delimiter]) throw new Error('Не найден разделитель CSV. Используй точку с запятой, запятую или табуляцию.');
    return delimiter;
  }

  function csvRows(text, delimiter) {
    const rows = [];
    let row = [], field = '', quoted = false, closedQuote = false;
    function finishField() { row.push(field); field = ''; closedQuote = false; }
    function finishRow() {
      finishField();
      if (!(row.length === 1 && row[0].trim() === '')) rows.push(row);
      row = [];
      if (rows.length > MAX_ROWS + 1) throw new Error('В одном CSV допускается не более 1000 профилей.');
    }
    for (let index = 0; index < text.length; index += 1) {
      const ch = text[index];
      if (quoted) {
        if (ch === '"') {
          if (text[index + 1] === '"') { field += '"'; index += 1; }
          else { quoted = false; closedQuote = true; }
        } else field += ch;
      } else if (ch === delimiter) {
        finishField();
      } else if (ch === '\n' || ch === '\r') {
        finishRow();
        if (ch === '\r' && text[index + 1] === '\n') index += 1;
      } else if (ch === '"') {
        if (field !== '' || closedQuote) throw new Error('Некорректные кавычки в CSV около строки ' + (rows.length + 1) + '.');
        quoted = true;
      } else if (closedQuote) {
        if (ch !== ' ' && ch !== '\t') throw new Error('После закрывающей кавычки должен быть разделитель или конец строки.');
      } else field += ch;
    }
    if (quoted) throw new Error('В CSV не закрыты кавычки.');
    if (field !== '' || closedQuote || row.length) finishRow();
    return rows;
  }

  function readNumber(raw, integer, delimiter, line, column) {
    let value = raw.trim();
    if (delimiter === ';') value = value.replace(',', '.');
    if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) {
      throw new Error('Строка ' + line + ', ' + column + ': нужно число от 1 до 5; пустые ячейки не допускаются.');
    }
    const number = Number(value);
    finiteNumber(number, 'Строка ' + line + ', ' + column, 1, 5);
    if (integer && !Number.isInteger(number)) throw new Error('Строка ' + line + ', ' + column + ': ответ должен быть целым числом 1–5.');
    return number;
  }

  function parseCsv(text) {
    if (typeof text !== 'string') throw new Error('CSV нужно передать как текст.');
    const bytes = typeof TextEncoder === 'function' ? new TextEncoder().encode(text).length : text.length * 3;
    if (bytes > MAX_CSV_BYTES) throw new Error('CSV слишком большой. Максимальный размер — 1 МБ.');
    text = text.replace(/^\uFEFF/, '').replace(/^(?:\r?\n)+/, '');
    if (!text.trim()) throw new Error('CSV пуст.');
    const delimiter = detectDelimiter(text);
    const rows = csvRows(text, delimiter);
    if (rows.length < 2) throw new Error('В CSV должны быть заголовок и хотя бы один профиль.');
    const header = rows[0].map(function (item) { return item.trim(); });
    if (header[0] !== 'id') throw new Error('Первый столбец должен называться id.');
    if (new Set(header).size !== header.length) throw new Error('Заголовки столбцов не должны повторяться.');
    const questions = Array.from({ length: 32 }, function (_, i) { return 'q' + (i + 1); });
    const scaleIds = SCALES.map(function (scale) { return scale.id; });
    const fields = header.filter(function (key) { return key !== 'id' && key !== 'source'; });
    const isAnswers = fields.length === 32 && questions.every(function (key) { return fields.includes(key); });
    const isScores = fields.length === 8 && scaleIds.every(function (key) { return fields.includes(key); });
    if (!isAnswers && !isScores) {
      throw new Error('После id нужны все q1–q32 либо все 8 шкал: ' + scaleIds.join(', ') + '. Дополнительно допустим только source.');
    }
    const orderedFields = isAnswers ? questions : scaleIds;
    const indices = orderedFields.map(function (key) { return header.indexOf(key); });
    const sourceIndex = header.indexOf('source');
    const seen = new Set();
    const profiles = rows.slice(1).map(function (row, index) {
      const line = index + 2;
      if (row.length !== header.length) throw new Error('Строка ' + line + ': число ячеек не совпадает с заголовком.');
      const id = validId(row[0].trim(), line);
      if (seen.has(id)) throw new Error('Строка ' + line + ': повторяется id ' + id + '.');
      seen.add(id);
      const source = sourceIndex === -1 ? 'respondent' : row[sourceIndex].trim();
      if (source !== 'synthetic' && source !== 'respondent') {
        throw new Error('Строка ' + line + ': source должен быть synthetic или respondent.');
      }
      const values = indices.map(function (column, fieldIndex) {
        return readNumber(row[column], isAnswers, delimiter, line, orderedFields[fieldIndex]);
      });
      return {
        id: id,
        name: 'Респондент ' + id,
        context: isAnswers ? 'Загруженные ответы' : 'Загруженные средние',
        scores: isAnswers ? scoreAnswers(values) : values,
        synthetic: source === 'synthetic'
      };
    });
    return { profiles: profiles, format: isAnswers ? 'answers' : 'scores' };
  }

  function profileCsv(profiles) {
    if (!Array.isArray(profiles) || profiles.length === 0 || profiles.length > MAX_ROWS) {
      throw new Error('Для экспорта нужны от 1 до 1000 профилей.');
    }
    const seen = new Set();
    const header = ['id', 'source'].concat(SCALES.map(function (scale) { return scale.id; }));
    const rows = profiles.map(function (profile) {
      const id = validId(profile.id);
      if (seen.has(id)) throw new Error('Для экспорта нужны уникальные id.');
      seen.add(id);
      if (!Array.isArray(profile.scores) || profile.scores.length !== 8) throw new Error('Профиль ' + id + ': нужны все 8 средних баллов.');
      const values = profile.scores.map(function (value, index) {
        return finiteNumber(value, 'Профиль ' + id + ', ' + SCALES[index].label, 1, 5);
      });
      return [id, profile.synthetic === true ? 'synthetic' : 'respondent'].concat(values).join(';');
    });
    return '\uFEFF' + [header.join(';')].concat(rows).join('\r\n') + '\r\n';
  }

  function round1(value) { return Math.round((value + Number.EPSILON) * 10) / 10; }
  function clamp(value) { return Math.min(100, Math.max(0, value)); }

  function validateState(state) {
    if (!state || typeof state !== 'object') throw new Error('Не задано состояние игры.');
    ['energy', 'resources', 'progress'].forEach(function (key) { finiteNumber(state[key], key, 0, 100); });
    const day = state.day === undefined ? 0 : state.day;
    if (!Number.isInteger(day) || day < 0 || day > DAYS) throw new Error('День игры должен быть целым числом от 0 до 4.');
    return day;
  }

  function simulateDay(state, plan, caseObj) {
    const day = validateState(state);
    if (day >= DAYS) throw new Error('Четыре дня уже завершены. Начни игру заново.');
    if (!plan || typeof plan !== 'object') throw new Error('Не задан план на день.');
    ['study', 'rest', 'support'].forEach(function (key) {
      if (!Number.isInteger(plan[key]) || plan[key] < 0 || plan[key] > HOURS) throw new Error('Часы ' + key + ': нужно целое число от 0 до 6.');
    });
    if (plan.study + plan.rest + plan.support > HOURS) throw new Error('На один день доступно только 6 часов.');
    if (!caseObj || typeof caseObj !== 'object') throw new Error('Не выбран сценарий.');
    const interest = finiteNumber(caseObj.interest, 'Интерес', 0, 100);
    // Условные коэффициенты специально видны: это игровая модель, не эмпирический прогноз.
    const workGain = round1(plan.study * (0.6 + 0.4 * interest / 100) * (2 + 0.04 * state.energy + 0.02 * state.resources));
    const energy = round1(clamp(state.energy + 8 * plan.rest + 2 * plan.support - 7 * plan.study));
    const resources = round1(clamp(state.resources + 10 * plan.support - 2 * plan.study));
    const progress = round1(clamp(state.progress + workGain));
    return {
      energy: energy, resources: resources, progress: progress, day: day + 1,
      delta: { energy: round1(energy - state.energy), resources: round1(resources - state.resources), progress: round1(progress - state.progress) },
      workGain: workGain
    };
  }

  function evaluateGame(state, caseObj) {
    const day = validateState(state);
    if (!caseObj || typeof caseObj !== 'object') throw new Error('Не выбран сценарий.');
    const goal = finiteNumber(caseObj.goal, 'Цель', 0, 100);
    const finished = day >= DAYS;
    const checks = [
      { label: 'Прогресс', passed: state.progress >= goal, value: state.progress, target: goal },
      { label: 'Энергия', passed: state.energy >= 20, value: state.energy, target: 20 },
      { label: 'Ресурсы', passed: state.resources >= 15, value: state.resources, target: 15 }
    ];
    const won = finished && checks.every(function (check) { return check.passed; });
    return {
      finished: finished, won: won, checks: checks,
      message: !finished ? 'Планируй следующий день. Цели оцениваются после четвёртого дня.' : won ? 'План сработал: задача выполнена, запас энергии и ресурсов сохранён.' : 'Этот план не выполнил все условия. Посмотри на график и попробуй другое распределение времени.'
    };
  }

  // Защищаем исходные демоданные от случайного изменения интерфейсом.
  function deepFreeze(value) {
    Object.getOwnPropertyNames(value).forEach(function (key) {
      if (value[key] && typeof value[key] === 'object') deepFreeze(value[key]);
    });
    return Object.freeze(value);
  }
  deepFreeze(SCALES); deepFreeze(DEMO_PROFILES); deepFreeze(CASES);

  return Object.freeze({
    VERSION: VERSION, SCALES: SCALES, DEMO_PROFILES: DEMO_PROFILES, CASES: CASES,
    normalize: normalize, scoreAnswers: scoreAnswers, parseCsv: parseCsv,
    profileCsv: profileCsv, simulateDay: simulateDay, evaluateGame: evaluateGame
  });
});
