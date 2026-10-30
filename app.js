(function () {
  'use strict';
  const M = window.PsyModel;
  const S = window.PsySurveyData;
  if (!M) { document.body.insertAdjacentHTML('beforeend', '<div class="noscript">Не удалось загрузить model.js. Проверь, что все файлы распакованы в одну папку.</div>'); return; }
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const fmt = value => new Intl.NumberFormat('ru-RU', {maximumFractionDigits:2}).format(value);
  const colors = {purple:'#7764d6',teal:'#399f91',orange:'#df9c68',gray:'#aeb3c3',grid:'#edeef4',text:'#9b97ac'};
  let imported = [];
  let personalProfile = null;
  let surveyDraft = Array(32).fill(null);
  let surveyStep = 0;
  let surveyActive = false;
  let selected = M.DEMO_PROFILES[0];
  let experiment = [...selected.scores];
  let unit = 'standard';
  let selectedCase = M.CASES[0];
  let game = {...selectedCase.initial, day:0};
  let history = [{...game}];
  let plans = [];
  let plan = {study:3,rest:2,support:1};
  let toastTimeout;

  function toast(message) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => { $('toast').hidden = true; }, 4200);
  }

  function activateTab(name, scroll) {
    if (!['profile','game','method'].includes(name)) name = 'profile';
    document.querySelectorAll('.tab-panel').forEach(el => { el.hidden = el.id !== 'panel-' + name; });
    document.querySelectorAll('.nav-button').forEach(button => {
      const active = button.dataset.tab === name;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    try { window.history.replaceState(null, '', '#' + name); } catch (_) { /* A file:// preview can restrict History. */ }
    if (scroll) window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }

  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => activateTab(button.dataset.tab, true)));
  document.querySelector('.brand').addEventListener('click', event => { event.preventDefault(); activateTab('profile',true); });
  window.addEventListener('hashchange', () => activateTab(location.hash.slice(1),false));

  function rangeFill(input) {
    const value = (Number(input.value)-Number(input.min))/(Number(input.max)-Number(input.min))*100;
    input.style.setProperty('--fill', value + '%');
  }

  function chooseProfile(profile) {
    if(surveyActive)showSurvey(false);
    selected = profile;
    experiment = [...profile.scores];
    renderProfilePicker();
    renderSliders();
    renderProfile();
  }

  function renderProfilePicker() {
    $('profile-pills').innerHTML = M.DEMO_PROFILES.map((profile,index) => '<button class="profile-pill '+(selected===profile?'selected':'')+'" data-profile="'+index+'" aria-pressed="'+(selected===profile)+'"><span class="pill-avatar">'+['А','Б','В'][index]+'</span><span>'+esc(profile.context)+'</span></button>').join('');
    if(personalProfile)$('profile-pills').insertAdjacentHTML('afterbegin','<button id="personal-profile-pill" class="profile-pill '+(selected===personalProfile?'selected':'')+'" aria-pressed="'+(selected===personalProfile)+'"><span class="pill-avatar">Я</span><span>Мой результат</span></button>');
    $('profile-pills').querySelectorAll('[data-profile]').forEach(button => button.addEventListener('click', () => chooseProfile(M.DEMO_PROFILES[Number(button.dataset.profile)])));
    if(personalProfile)$('personal-profile-pill').addEventListener('click',()=>chooseProfile(personalProfile));
    $('imported-select-wrap').hidden = imported.length === 0;
    $('clear-imported').hidden = imported.length === 0;
    $('imported-select').innerHTML = '<option value="">Выбрать респондента…</option>' + imported.map((profile,index) => '<option value="'+index+'"'+(selected===profile?' selected':'')+'>'+esc(profile.name)+(profile.synthetic?' · учебные данные':'')+'</option>').join('');
  }

  $('imported-select').addEventListener('change', event => {
    if (event.target.value !== '') chooseProfile(imported[Number(event.target.value)]);
  });

  const sliderNames = ['Интерес к познанию','Сложные задачи','Саморазвитие','Самоуважение','Долг и вина','Одобрение родителей','Избегание проблем','Амотивация'];
  function renderSliders() {
    $('profile-sliders').innerHTML = M.SCALES.map((scale,index) => '<div class="profile-slider"><div class="slider-label"><label for="scale-'+scale.id+'" title="'+esc(scale.label+'. '+scale.description)+'">'+sliderNames[index]+'</label><output id="value-'+scale.id+'" for="scale-'+scale.id+'"></output></div><input class="range" id="scale-'+scale.id+'" type="range" min="1" max="5" step="0.01" value="'+experiment[index]+'" aria-description="'+esc(scale.description)+'"></div>').join('');
    M.SCALES.forEach((scale,index) => {
      const input = $('scale-' + scale.id);
      rangeFill(input);
      input.addEventListener('input', () => {
        experiment[index] = Number(input.value);
        rangeFill(input);
        renderProfile();
      });
    });
  }

  function profileSvg() {
    const compact=window.matchMedia('(max-width:700px)').matches;
    const W=compact?440:800,H=compact?300:340,left=compact?36:45,right=25,top=38,bottom=compact?50:70;
    const plotW=W-left-right,plotH=H-top-bottom;
    const yMin=unit==='raw'?1:0,yMax=unit==='raw'?5:100;
    const value = v => unit==='raw'?v:M.normalize(v);
    const x = i => left + plotW * i / 7;
    const y = v => top + plotH * (1-(value(v)-yMin)/(yMax-yMin));
    const ticks = unit==='raw'?[1,2,3,4,5]:[0,25,50,75,100];
    const labelLines = compact?[['Позн.'],['Дост.'],['Разв.'],['Само-','уваж.'],['Долг'],['Одобр.'],['Избег.'],['Амот.']]:[['Познание'],['Достижение'],['Саморазвитие'],['Само-','уважение'],['Долг','и вина'],['Одобрение'],['Избегание'],['Амотивация']];
    let svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-labelledby="profile-svg-title profile-svg-desc"><title id="profile-svg-title">Мотивационный профиль: исходные баллы и эксперимент</title><desc id="profile-svg-desc">'+esc(M.SCALES.map((s,i)=>s.short+': исходный '+fmt(selected.scores[i])+', эксперимент '+fmt(experiment[i])+' из 5').join('; '))+'. Точные значения доступны в таблице под графиком.</desc><defs><linearGradient id="profile-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#a28be0" stop-opacity=".18"/><stop offset="100%" stop-color="#a28be0" stop-opacity=".015"/></linearGradient></defs>';
    ticks.forEach(tick => {
      const ty=top+plotH*(1-(tick-yMin)/(yMax-yMin));
      svg+='<line x1="'+left+'" x2="'+(W-right)+'" y1="'+ty+'" y2="'+ty+'" stroke="'+colors.grid+'" stroke-dasharray="3 5"/><text x="'+(left-16)+'" y="'+(ty+4)+'" text-anchor="end" font-size="11" fill="'+colors.text+'">'+tick+'</text>';
    });
    svg+='<text x="'+(left-17)+'" y="17" text-anchor="middle" font-size="9" fill="#aaa3b9">баллы</text>';
    const line = values => values.map((v,i)=>(i?'L':'M')+x(i).toFixed(2)+','+y(v).toFixed(2)).join(' ');
    svg+='<path d="'+line(experiment)+' L '+x(7)+','+(top+plotH)+' L '+x(0)+','+(top+plotH)+' Z" fill="url(#profile-area)"/>';
    svg+='<path d="'+line(selected.scores)+'" fill="none" stroke="'+colors.gray+'" stroke-width="2.5" stroke-dasharray="5 6" stroke-linejoin="round"/>';
    selected.scores.forEach((v,i)=>{svg+='<circle cx="'+x(i)+'" cy="'+y(v)+'" r="4" fill="white" stroke="'+colors.gray+'" stroke-width="2"/>';});
    svg+='<path d="'+line(experiment)+'" fill="none" stroke="'+colors.purple+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    experiment.forEach((v,i)=>{
      const display=fmt(value(v));
      svg+='<circle cx="'+x(i)+'" cy="'+y(v)+'" r="5" fill="white" stroke="'+colors.purple+'" stroke-width="2.5"><title>'+esc(M.SCALES[i].label+': '+fmt(v)+' из 5; '+fmt(M.normalize(v))+' из 100')+'</title></circle>';
      svg+='<text x="'+x(i)+'" y="'+(y(v)-14)+'" text-anchor="middle" font-size="11" font-weight="600" fill="#8070b7">'+display+'</text>';
      labelLines[i].forEach((label,row)=>{svg+='<text x="'+x(i)+'" y="'+(H-bottom+25+row*15)+'" text-anchor="middle" font-size="10" fill="'+colors.text+'">'+label+'</text>';});
    });
    svg+='</svg>';
    if(compact)svg=svg.replace(/font-size="9"/g,'font-size="11"').replace(/font-size="10"/g,'font-size="12"').replace(/font-size="11"/g,'font-size="13"');
    return svg;
  }

  function renderProfile() {
    const own=selected.origin==='questionnaire';
    $('profile-title').textContent = M.DEMO_PROFILES.includes(selected)?selected.context:selected.name;
    $('data-badge').textContent = own?'Твои ответы · 32 из 32':selected.synthetic?'Учебные данные':'Загруженные результаты';
    $('data-badge').className = 'badge '+(selected.synthetic?'badge-lilac':'badge-mint');
    $('profile-origin').textContent = own?'Баллы автоматически рассчитаны по твоим 32 ответам. Бегунки уже стоят на полученных значениях.':selected.synthetic?'Вымышленный пример по восьми шкалам ШАМ-Ш. Название — сюжет, не диагноз.':selected.context+'. Значения из вашего CSV; происхождение не проверяется программой.';
    $('profile-chart').innerHTML = profileSvg();
    $('axis-note').textContent = unit==='raw'?'X — виды мотивации · Y — среднее четырёх ответов, 1–5.':'X — виды мотивации · Y — положение в диапазоне шкалы, 0–100; не процентили.';
    M.SCALES.forEach((scale,i)=>{
      $('value-'+scale.id).innerHTML = fmt(experiment[i])+' <small>/ 5</small>';
      $('scale-'+scale.id).setAttribute('aria-valuetext', fmt(experiment[i])+' из 5; '+fmt(M.normalize(experiment[i]))+' из 100');
    });
    const diffs=experiment.map((v,i)=>v-selected.scores[i]);
    const changed=diffs.filter(d=>Math.abs(d)>.000001).length;
    if(changed===0&&own){
      const top=Math.max(...selected.scores);
      const indices=selected.scores.map((v,i)=>v===top?i:-1).filter(i=>i!==-1);
      if(indices.length===8){
        $('profile-insight').innerHTML='По твоим ответам все восемь шкал получили <strong>'+fmt(top)+' из 5</strong>. Причины учёбы описаны ниже отдельно. Бегунки можно использовать для дальнейшего эксперимента.';
      }else{
        $('profile-insight').innerHTML='Наибольший балл в твоём профиле — <strong>'+fmt(top)+' из 5</strong>: '+indices.map(i=>'«'+esc(M.SCALES[i].short)+'»').join(', ')+'. Это сравнение твоих шкал между собой, а не с другими людьми. Пояснения к каждой шкале — ниже.';
      }
    } else if (changed===0) {
      $('profile-insight').innerHTML='Линии пока совпадают. Передвинь любой бегунок: <strong>исходный профиль останется на месте</strong>, а цветная линия покажет твою гипотезу.';
    } else {
      const index=diffs.reduce((best,v,i)=>Math.abs(v)>Math.abs(diffs[best])?i:best,0);
      $('profile-insight').innerHTML='Изменено шкал: <strong>'+changed+' из 8</strong>. Самый большой сдвиг — «'+esc(M.SCALES[index].short)+'»: '+fmt(selected.scores[index])+' → <strong>'+fmt(experiment[index])+'</strong>. '+(index===7?'Рост амотивации не означает улучшение профиля.':'Другие мотивы не обязаны меняться вместе с ним.');
    }
    $('profile-table').innerHTML=M.SCALES.map((scale,i)=>'<tr><td>'+esc(scale.label)+'</td><td>'+fmt(selected.scores[i])+'</td><td>'+fmt(experiment[i])+'</td><td>'+fmt(M.normalize(experiment[i]))+'</td></tr>').join('');
    $('survey-personal-summary').hidden=!own;
    if(own)$('personal-scale-readings').innerHTML=M.SCALES.map((scale,i)=>'<div class="personal-reading"><div><b>'+esc(scale.label)+'</b><span class="score">'+fmt(selected.scores[i])+' <small>/ 5</small></span></div><p>'+esc(scale.description)+'</p></div>').join('');
  }

  $('reset-profile').addEventListener('click',()=>{experiment=[...selected.scores];renderSliders();renderProfile();toast('Эксперимент возвращён к исходным баллам.');});
  document.querySelectorAll('[data-unit]').forEach(button=>button.addEventListener('click',()=>{
    unit=button.dataset.unit;
    document.querySelectorAll('[data-unit]').forEach(el=>{el.classList.toggle('selected',el===button);el.setAttribute('aria-pressed',String(el===button));});
    renderProfile();
  }));

  function download(name,contents,type) {
    const blob=new Blob([contents],{type});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  $('export-experiment').addEventListener('click',()=>{
    const data={type:'hypothetical_profile',app:'Психограф',version:M.VERSION,method:'ШАМ-Ш, Гордеева и соавт., 2017',originalId:selected.id,originalSource:selected.origin==='questionnaire'?'questionnaire_self_report':selected.synthetic?'synthetic':'user_supplied',notice:'Экспериментальные баллы заданы бегунками и не являются повторными ответами респондента.',scaleIds:M.SCALES.map(s=>s.id),originalMeans:selected.scores,experimentalMeans:experiment,experimentalDisplay100:experiment.map(M.normalize)};
    if(selected.origin==='questionnaire')data.originalAnswers=[...selected.answers];
    download('psycho-experiment-'+selected.id+'.json',JSON.stringify(data,null,2),'application/json;charset=utf-8');
    toast('Сохранён JSON с исходником и пометкой «гипотетический профиль».');
  });
  $('export-originals').addEventListener('click',()=>{
    const data=imported.includes(selected)?imported:M.DEMO_PROFILES.includes(selected)?M.DEMO_PROFILES:[selected];
    download('psycho-original-scores.csv',M.profileCsv(data),'text/csv;charset=utf-8');
    toast('Экспортированы исходные средние. Изменения бегунков в CSV не включены.');
  });

  const dialog=$('import-dialog');
  $('open-import').addEventListener('click',()=>{ $('import-error').hidden=true; dialog.showModal(); });
  $('close-import').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
  function importError(error) { $('import-error').textContent=error.message||String(error);$('import-error').hidden=false; }
  $('csv-file').addEventListener('change',async event=>{
    $('import-error').hidden=true;
    const file=event.target.files[0];
    if (!file) return;
    if(file.size>1000000){importError(new Error('Файл больше 1 МБ. Выбери меньший CSV.'));event.target.value='';return;}
    try {$('csv-text').value=await file.text();}catch(error){importError(new Error('Не удалось прочитать файл. Попробуй вставить его текст.'));}
  });
  $('parse-csv').addEventListener('click',()=>{
    try {
      const result=M.parseCsv($('csv-text').value);
      imported=result.profiles;
      chooseProfile(imported[0]);
      $('csv-text').value='';$('csv-file').value='';$('import-error').hidden=true;
      dialog.close();
      toast('Загружено профилей: '+imported.length+'. '+(result.format==='answers'?'Средние рассчитаны по 32 ответам.':'Использованы готовые средние.'));
    }catch(error){importError(error);}
  });
  $('clear-imported').addEventListener('click',()=>{
    const removingSelected=imported.includes(selected);
    imported=[];
    if(removingSelected)chooseProfile(personalProfile||M.DEMO_PROFILES[0]);else renderProfilePicker();
    $('csv-text').value='';$('csv-file').value='';$('import-error').hidden=true;dialog.close();toast('Загруженные профили удалены из памяти страницы.');
  });

  function surveyAnswerCount(){return surveyDraft.filter(value=>Number.isInteger(value)&&value>=1&&value<=5).length;}

  function updateSurveyEntry(){
    const count=surveyAnswerCount();
    const edited=personalProfile&&surveyDraft.some((value,index)=>value!==personalProfile.answers[index]);
    $('survey-edit-answers').textContent=edited?'Продолжить текущий опрос':'Посмотреть мои ответы';
    $('survey-show-result').hidden=!personalProfile;
    $('survey-new').hidden=count===0&&!personalProfile;
    if(personalProfile&&count===32&&edited){
      $('survey-entry-status').textContent='Ответы изменены · результат пока прежний';
      $('survey-entry-heading').textContent='Завершим обновление профиля?';
      $('survey-entry-copy').textContent='На графике остаётся последний завершённый результат. Закончи опрос, чтобы пересчитать шкалы.';
      $('survey-start').textContent='Вернуться к ответам →';
    }else if(personalProfile&&count===32){
      $('survey-entry-status').textContent='Твой профиль готов · 32 ответа';
      $('survey-entry-heading').textContent='Твой профиль готов к исследованию.';
      $('survey-entry-copy').textContent='Можно посмотреть ответы, сохранить их или исследовать профиль с помощью бегунков.';
      $('survey-start').textContent='Посмотреть мои ответы';
    }else if(count>0){
      $('survey-entry-status').textContent='Ответов: '+count+' из 32';
      $('survey-entry-heading').textContent='Продолжим с того же места?';
      $('survey-entry-copy').textContent='Черновик сохранён в этой вкладке. График появится после всех 32 ответов.';
      $('survey-start').textContent='Продолжить опрос →';
    }else{
      $('survey-entry-status').textContent='32 утверждения · 4 коротких шага';
      $('survey-entry-heading').textContent='Сначала — твои ответы.';
      $('survey-entry-copy').textContent='Пройди опрос прямо здесь. Восемь шкал и график рассчитаются автоматически.';
      $('survey-start').textContent='Пройти опрос →';
    }
  }

  function showSurvey(active){
    surveyActive=active;
    $('survey-workspace').hidden=!active;
    $('profile-hero').hidden=active;
    $('survey-entry').hidden=active;
    $('profile-lab').hidden=active;
    if(active){renderSurveyStep();focusSurveyHeading();}else updateSurveyEntry();
  }

  function focusSurveyHeading(){
    $('survey-heading').focus({preventScroll:true});
    $('survey-workspace').scrollIntoView({block:'start',behavior:'auto'});
  }

  function updateSurveyProgress(){
    const count=surveyAnswerCount();
    const start=surveyStep*8;
    const pageCount=surveyDraft.slice(start,start+8).filter(v=>v!==null).length;
    $('survey-count').textContent='Ответов: '+count+' из 32';
    $('survey-progress').value=count;
    $('survey-step-label').textContent='Шаг '+(surveyStep+1)+' из 4 · вопросы '+(start+1)+'–'+(start+8);
    $('survey-page-note').textContent='На этом шаге: '+pageCount+' из 8';
  }

  function renderSurveyStep(){
    const start=surveyStep*8;
    $('survey-questions').innerHTML=S.questions.slice(start,start+8).map(question=>'<fieldset class="survey-question" data-number="'+question.number+'"><legend><span class="question-number">'+question.number+'</span>'+esc(question.text)+'</legend><div class="survey-options">'+S.options.map(option=>'<label class="survey-option" for="answer-'+question.number+'-'+option.value+'"><input type="radio" name="q'+question.number+'" id="answer-'+question.number+'-'+option.value+'" value="'+option.value+'" aria-label="'+option.value+' — '+esc(option.label)+'"'+(surveyDraft[question.number-1]===option.value?' checked':'')+'><span class="survey-option-face"><b>'+option.value+'</b><span>'+esc(option.label)+'</span></span></label>').join('')+'</div></fieldset>').join('');
    $('survey-error').hidden=true;
    $('survey-back').disabled=surveyStep===0;
    $('survey-next').textContent=surveyStep===3?'Показать мой профиль →':'Дальше →';
    updateSurveyProgress();
  }

  $('survey-questions').addEventListener('change',event=>{
    const input=event.target;
    if(!input.matches('input[type="radio"]'))return;
    const number=Number(input.name.slice(1)),value=Number(input.value);
    if(!Number.isInteger(number)||number<1||number>32||!Number.isInteger(value)||value<1||value>5)return;
    surveyDraft[number-1]=value;
    input.closest('fieldset').classList.remove('missing');
    $('survey-error').hidden=true;
    updateSurveyProgress();
  });

  $('survey-start').addEventListener('click',()=>{
    if(!S){toast('Не удалось загрузить вопросы. Проверь наличие survey-data.js рядом с index.html.');return;}
    const missing=surveyDraft.findIndex(value=>value===null);
    surveyStep=missing<0?0:Math.floor(missing/8);
    showSurvey(true);
  });
  $('survey-close').addEventListener('click',()=>{showSurvey(false);$('survey-start').focus({preventScroll:true});});
  $('survey-back').addEventListener('click',()=>{if(surveyStep>0){surveyStep-=1;renderSurveyStep();focusSurveyHeading();}});
  $('survey-form').addEventListener('submit',event=>{
    event.preventDefault();
    const missing=[];
    for(let i=surveyStep*8;i<surveyStep*8+8;i++)if(surveyDraft[i]===null)missing.push(i+1);
    if(missing.length){
      $('survey-error').textContent='Выбери ответ для '+(missing.length===1?'утверждения ':'утверждений ')+missing.join(', ')+'. Пропущенные ответы не заменяются нулями.';
      $('survey-error').hidden=false;
      missing.forEach(number=>{$('survey-questions').querySelector('[data-number="'+number+'"]').classList.add('missing');});
      const first=$('answer-'+missing[0]+'-1');first.focus({preventScroll:true});first.closest('fieldset').scrollIntoView({block:'center',behavior:'auto'});
      return;
    }
    if(surveyStep<3){surveyStep+=1;renderSurveyStep();focusSurveyHeading();return;}
    try{
      const answers=[...surveyDraft];
      const scores=M.scoreAnswers(answers);
      personalProfile=Object.freeze({id:'self01',name:'Мой профиль мотивации',context:'Ответы встроенного опросника',origin:'questionnaire',synthetic:false,answers:Object.freeze(answers),scores:Object.freeze([...scores])});
      chooseProfile(personalProfile);
      showSurvey(false);
      $('profile-title').setAttribute('tabindex','-1');$('profile-title').focus({preventScroll:true});
      $('profile-lab').scrollIntoView({block:'start',behavior:'auto'});
      toast('Готово: все восемь шкал рассчитаны по твоим ответам.');
    }catch(error){$('survey-error').textContent=error.message;$('survey-error').hidden=false;}
  });
  $('survey-show-result').addEventListener('click',()=>{if(personalProfile){chooseProfile(personalProfile);$('profile-lab').scrollIntoView({block:'start',behavior:'auto'});}});
  $('survey-edit-answers').addEventListener('click',()=>{
    if(personalProfile){const missing=surveyDraft.findIndex(value=>value===null);surveyStep=missing<0?0:Math.floor(missing/8);showSurvey(true);}
  });
  $('survey-new').addEventListener('click',()=>{surveyDraft=Array(32).fill(null);surveyStep=0;showSurvey(true);});
  $('survey-export-answers').addEventListener('click',()=>{
    if(!personalProfile)return;
    const header=['id','source',...Array.from({length:32},(_,i)=>'q'+(i+1))];
    const row=[personalProfile.id,'respondent',...personalProfile.answers];
    download('psychograph-my-answers.csv','\uFEFF'+header.join(';')+'\r\n'+row.join(';')+'\r\n','text/csv;charset=utf-8');
    toast('Сохранены твои 32 исходных ответа. Этот CSV можно загрузить обратно в приложение.');
  });
  if(S){
    $('survey-instruction').textContent=S.instruction;
    $('survey-scale-key').innerHTML=S.options.map(option=>'<span><b>'+option.value+'</b>'+esc(option.label)+'</span>').join('');
    $('survey-attribution').textContent=S.attribution;
  }

  function resetGame(caseObj) {
    selectedCase=caseObj;
    game={...caseObj.initial,day:0};history=[{...game}];plans=[];plan={study:3,rest:2,support:1};
    $('game-result').hidden=true;
    renderCasePicker();renderGame();
  }
  function renderCasePicker() {
    $('case-picker').innerHTML=M.CASES.map((item,index)=>'<button class="case-button '+(item===selectedCase?'selected':'')+'" data-case="'+index+'" aria-pressed="'+(item===selectedCase)+'"><span class="case-index">0'+(index+1)+'</span><span><strong>'+esc(item.title)+'</strong><small>Цель: '+item.goal+' подготовки · 4 дня</small></span></button>').join('');
    $('case-picker').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>resetGame(M.CASES[Number(button.dataset.case)])));
  }
  $('reset-game').addEventListener('click',()=>{resetGame(selectedCase);toast('Четыре новых дня. Можно попробовать другой план.');});
  $('view-case-profile').addEventListener('click',()=>{chooseProfile(M.DEMO_PROFILES.find(p=>p.id===selectedCase.profileId));activateTab('profile',true);});

  ['study','rest','support'].forEach(key=>{
    $('plan-'+key).addEventListener('input',event=>{
      const other=Object.keys(plan).filter(k=>k!==key).reduce((sum,k)=>sum+plan[k],0);
      const requested=Number(event.target.value);
      plan[key]=Math.min(requested,6-other);
      if(requested!==plan[key])toast('В сутках игры 6 свободных часов. Сначала убавь другой бегунок.');
      updatePlanPreview();
    });
  });

  function gameSvg(forecast) {
    const compact=window.matchMedia('(max-width:700px)').matches;
    const W=compact?440:760,H=280,left=42,right=27,top=25,bottom=46;
    const x=day=>left+(W-left-right)*day/4;
    const y=v=>top+(H-top-bottom)*(1-v/100);
    let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-labelledby="game-svg-title game-svg-desc"><title id="game-svg-title">Подготовка, энергия и ресурсы за четыре дня</title><desc id="game-svg-desc">Сейчас: подготовка '+fmt(game.progress)+', энергия '+fmt(game.energy)+', ресурсы '+fmt(game.resources)+'. '+(forecast?'Прогноз следующего дня: подготовка '+fmt(forecast.progress)+', энергия '+fmt(forecast.energy)+', ресурсы '+fmt(forecast.resources)+'.':'Четыре дня завершены.')+'</desc>';
    [0,25,50,75,100].forEach(tick=>{svg+='<line x1="'+left+'" x2="'+(W-right)+'" y1="'+y(tick)+'" y2="'+y(tick)+'" stroke="'+colors.grid+'" stroke-dasharray="3 5"/><text x="'+(left-14)+'" y="'+(y(tick)+4)+'" text-anchor="end" font-size="11" fill="'+colors.text+'">'+tick+'</text>';});
    [0,1,2,3,4].forEach(day=>{svg+='<text x="'+x(day)+'" y="'+(H-18)+'" text-anchor="middle" font-size="11" fill="'+colors.text+'">'+(day===0?'Старт':'День '+day)+'</text>';});
    svg+='<line x1="'+left+'" x2="'+(W-right)+'" y1="'+y(selectedCase.goal)+'" y2="'+y(selectedCase.goal)+'" stroke="#cfc6e8" stroke-dasharray="2 6"/><text x="'+(W-right-2)+'" y="'+(y(selectedCase.goal)-7)+'" text-anchor="end" font-size="9" fill="#aca0c5">Цель подготовки · '+selectedCase.goal+'</text>';
    if(forecast)svg+='<rect x="'+(x(game.day)+1)+'" y="'+top+'" width="'+(x(forecast.day)-x(game.day)-1)+'" height="'+(H-top-bottom)+'" fill="#f4f1fb" opacity=".55"/>';
    [['progress',colors.purple],['energy',colors.teal],['resources',colors.orange]].forEach(([key,color])=>{
      const d=history.map((point,index)=>(index?'L':'M')+x(point.day)+','+y(point[key])).join(' ');
      svg+='<path d="'+d+'" stroke="'+color+'" stroke-width="2.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
      if(forecast)svg+='<path d="M'+x(game.day)+','+y(game[key])+' L'+x(forecast.day)+','+y(forecast[key])+'" stroke="'+color+'" stroke-width="2.2" stroke-dasharray="5 5" fill="none"/><circle cx="'+x(forecast.day)+'" cy="'+y(forecast[key])+'" r="4" stroke="'+color+'" fill="white" stroke-width="2"/>';
      history.forEach(point=>{svg+='<circle cx="'+x(point.day)+'" cy="'+y(point[key])+'" r="4" stroke="'+color+'" fill="white" stroke-width="2"/>';});
    });
    if(compact)svg=svg.replace(/font-size="9"/g,'font-size="11"').replace(/font-size="11"/g,'font-size="13"');
    return svg+'</svg>';
  }

  function updatePlanPreview() {
    const finished=game.day>=4;
    const used=plan.study+plan.rest+plan.support;
    $('time-used').textContent=used;
    $('time-free').textContent=used===6?'Всё распределено':'Свободно: '+(6-used)+' ч';
    $('time-blocks').innerHTML=['study','rest','support'].flatMap(key=>Array.from({length:plan[key]},()=>'<i class="'+key+'"></i>')).concat(Array.from({length:6-used},()=>'<i></i>')).join('');
    ['study','rest','support'].forEach(key=>{
      const input=$('plan-'+key);input.value=plan[key];input.disabled=finished;rangeFill(input);
      input.setAttribute('aria-valuetext',plan[key]+' часов');
      $('plan-'+key+'-value').textContent=plan[key]+' ч';
    });
    const forecast=finished?null:M.simulateDay(game,plan,selectedCase);
    $('game-chart').innerHTML=gameSvg(forecast);
    if(forecast){
      $('day-preview').innerHTML='<strong>К вечеру: +'+fmt(forecast.workGain)+' подготовки</strong>Энергия '+fmt(game.energy)+' → '+fmt(forecast.energy)+' · Ресурсы '+fmt(game.resources)+' → '+fmt(forecast.resources);
    }else{
      $('day-preview').innerHTML='<strong>Четыре дня завершены</strong>Посмотри результат и обсуди, что повлияло на траекторию.';
    }
    $('advance-day').disabled=finished;
    $('advance-day').innerHTML=finished?'Эксперимент завершён':'Прожить день '+(game.day+1)+' <span aria-hidden="true">→</span>';
    renderStats(forecast);
  }

  function renderStats(forecast) {
    const stats=[['progress','Подготовка','study'],['energy','Энергия','rest'],['resources','Ресурсы','support']];
    $('game-stats').innerHTML=stats.map(([key,label,dot])=>{
      const diff=forecast?forecast[key]-game[key]:0;
      return '<div class="stat '+key+'"><div class="stat-top"><span class="plan-dot '+dot+'"></span>'+label+'</div><div class="stat-value"><strong>'+fmt(game[key])+'</strong><span>/ 100</span>'+(forecast?'<span class="stat-delta">'+(diff>0?'+':'')+fmt(diff)+'</span>':'')+'</div><div class="stat-bar"><i style="width:'+game[key]+'%"></i></div></div>';
    }).join('');
  }

  function renderGame() {
    $('case-kicker').textContent=selectedCase.kicker;
    $('case-title').textContent=selectedCase.title;
    $('case-story').textContent=selectedCase.story;
    $('day-label').textContent=game.day<4?'День '+(game.day+1)+' из 4':'Финиш · 4 дня';
    $('planner-kicker').textContent=game.day<4?'ПЛАН НА ДЕНЬ '+(game.day+1):'ЭКСПЕРИМЕНТ ЗАВЕРШЁН';
    $('interest-label').textContent='Интерес: '+fmt(selectedCase.interest)+' / 100 · вымышленный профиль';
    $('game-goal').innerHTML='<span class="small-label">УСЛОВИЯ ПОБЕДЫ К КОНЦУ 4-ГО ДНЯ</span><p>Подготовка <strong>≥ '+selectedCase.goal+'</strong><br>Энергия <strong>≥ 20</strong> · Ресурсы <strong>≥ 15</strong></p>';
    $('game-log').innerHTML=plans.length?plans.map((p,i)=>'<p><strong>День '+(i+1)+'.</strong> Учёба '+p.study+' ч · Восстановление '+p.rest+' ч · Поддержка '+p.support+' ч. Итог: подготовка '+fmt(history[i+1].progress)+', энергия '+fmt(history[i+1].energy)+', ресурсы '+fmt(history[i+1].resources)+'.</p>').join(''):'<p>Пока ни одного хода. Сначала распредели время и посмотри прогноз.</p>';
    updatePlanPreview();
  }

  $('advance-day').addEventListener('click',()=>{
    if(game.day>=4)return;
    plans.push({...plan});game=M.simulateDay(game,plan,selectedCase);history.push({...game});
    renderGame();
    if(game.day===4){renderResult();$('game-result').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});}
    else toast('День '+game.day+' прожит. Подготовка: '+fmt(game.progress)+'.');
  });

  function renderResult() {
    const outcome=M.evaluateGame(game,selectedCase);
    const answerIndices=selectedCase.id==='spark'?[1,0,2]:selectedCase.id==='pressure'?[2,1,0]:[0,2,1];
    $('game-result').hidden=false;
    $('game-result').innerHTML='<span class="badge '+(outcome.won?'badge-mint':'badge-peach')+'">'+(outcome.won?'Баланс найден':'Есть повод изменить план')+'</span><h2>'+(outcome.won?'Подготовка без потери всех сил.':'Это тоже результат эксперимента.')+'</h2><p>'+esc(outcome.message)+'</p><div class="result-checks">'+outcome.checks.map(check=>'<span class="check '+(check.passed?'pass':'')+'">'+(check.passed?'✓':'○')+' '+esc(check.label)+': '+fmt(check.value)+' / цель '+fmt(check.target)+'</span>').join('')+'</div>'+(!outcome.won?'<p>Подсказка: попробуй в начале накопить энергию и ресурсы, а интенсивную учёбу перенести ближе к зачёту. В этой модели условия начала дня влияют на отдачу от учёбы.</p>':'<p>Обсуди, какие решения помогли именно в этой модели. В реальном исследовании эффект каждого действия пришлось бы проверять отдельно.</p>')+'<div class="reflection"><span class="small-label">ПАУЗА ДЛЯ СМЫСЛА</span><h3>'+esc(selectedCase.question)+'</h3><div class="answer-options">'+answerIndices.map(index=>'<button class="answer-option" data-answer="'+index+'">'+esc(selectedCase.answers[index].text)+'</button>').join('')+'</div><p id="answer-feedback" class="answer-feedback" role="status"></p></div>';
    $('game-result').querySelectorAll('[data-answer]').forEach(button=>button.addEventListener('click',()=>{
      const answer=selectedCase.answers[Number(button.dataset.answer)];
      $('game-result').querySelectorAll('[data-answer]').forEach(el=>{el.classList.remove('chosen','correct');el.setAttribute('aria-pressed','false');});
      button.classList.add(answer.correct?'correct':'chosen');button.setAttribute('aria-pressed','true');
      $('answer-feedback').textContent=(answer.correct?'Верно. ':'Давай уточним. ')+answer.explanation;
    }));
  }

  $('scale-reference').innerHTML=M.SCALES.map(scale=>'<div class="scale-ref"><b>'+esc(scale.short)+'</b>'+esc(scale.description)+'<br><small>Пункты '+scale.items.join(', ')+'</small></div>').join('');
  renderProfilePicker();renderSliders();renderProfile();renderCasePicker();renderGame();
  updateSurveyEntry();
  let resizePending=false;
  window.addEventListener('resize',()=>{if(!resizePending){resizePending=true;requestAnimationFrame(()=>{resizePending=false;renderProfile();updatePlanPreview();});}});
  document.querySelectorAll('[data-unit]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.unit===unit)));
  activateTab(location.hash.slice(1),false);
})();
