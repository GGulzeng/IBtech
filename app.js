
let selectedGrade = null;
let selectedSubject = null;
let questions = [];
let idx = 0;
let correct = 0;
let timerId = null;
let timerLeft = 10;

// ===== Utils =====
function $(s){ return document.querySelector(s); }
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
function show(viewId, title){
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  $('#screenTitle').textContent = title || '퀴즈';
}
function back(){
  if($('#viewQuiz').classList.contains('active')){
    if(selectedGrade<=2) show('viewSubjectLow','과 목 선 택');
    else show('viewSubjectHigh','과 목 선 택');
  }else if($('#viewSubjectLow').classList.contains('active') || $('#viewSubjectHigh').classList.contains('active')){
    show('viewHome','퀴즈');
  }
}
$('#btnBack').addEventListener('click', back);

// ===== Month → Allowed Units =====
function getAllowedUnitsForMonth(month){
  const rule = {
    1: 'all', 2: 'all', 3: [1,2], 4: [1,2,3], 5: [4,5], 6: [5,6],
    7: 'all', 8: [1,2], 9: [1,2,3], 10: [4,5], 11: [5,6], 12: 'all'
  };
  return rule[month] ?? 'all';
}
function extractUnitNo(q){
  if (q.unit_no != null) return Number(q.unit_no);
  const txt = String(q.unit_display || q.unit || '');
  const m = txt.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}
// URL ?month=3 override for testing
function resolveTargetMonth(){
  const params = new URLSearchParams(location.search);
  const override = params.get('month');
  if (override) {
    const m = Number(override);
    if (m>=1 && m<=12) return m;
  }
  return new Date().getMonth()+1; // 1~12
}

// ===== Local JSON picker (fallback for file:// or blocked fetch) =====
async function pickLocalJson(){
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if(!file){ reject(new Error('no file')); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try{ resolve(JSON.parse(reader.result)); }catch(e){ reject(e); }
      };
      reader.onerror = (e) => reject(e);
      reader.readAsText(file, 'utf-8');
    };
    input.click();
  });
}
function notify(text){
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = 'position:fixed;left:50%;top:20px;transform:translateX(-50%);background:#111;color:#fff;padding:8px 12px;border-radius:8px;z-index:9999;opacity:0.95;font-size:14px';
  document.body.appendChild(el);
  setTimeout(()=> el.remove(), 3000);
}

// ===== Graph meta parser & SVG renderer =====
function parseGraphMeta(meta){
  if(!meta || !meta.data) return null;
  const raw = String(meta.data).trim();
  const type = raw.split(';')[0].trim().toUpperCase();
  const get = (key) => {
    const m = raw.match(new RegExp(key+"\\s*=\\s*([^;]+)","i"));
    if(!m) return null;
    return m[1].split(',').map(s => s.trim());
  };
  const labels = get('labels') || [];
  const values = (get('values') || []).map(v => Number(v));
  if(!labels.length || !values.length) return null;
  return { type, labels, values };
}
function renderGraphSVG(container, info){
  if(!info) { container.textContent = '그래프나 도형(포함된다면)'; return; }
  const w = container.clientWidth || container.offsetWidth || 700;
  const h = container.clientHeight || 220;
  const pad = {l:40, r:12, t:12, b:28};
  const cw = Math.max(50, w - pad.l - pad.r);
  const ch = Math.max(50, h - pad.t - pad.b);
  const maxV = Math.max(...info.values) || 1;
  const minV = Math.min(0, Math.min(...info.values));
  const span = (maxV - minV) || 1;

  const x = (i) => pad.l + (cw * (info.labels.length<=1 ? 0 : i/(info.labels.length-1)));
  const y = (v) => pad.t + ch - ((v - minV) / span) * ch;

  let svg = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t+ch}" stroke="#333" stroke-width="1"/>`;
  svg += `<line x1="${pad.l}" y1="${pad.t+ch}" x2="${pad.l+cw}" y2="${pad.t+ch}" stroke="#333" stroke-width="1"/>`;
  info.labels.forEach((lab, i)=>{
    const xx = x(i);
    svg += `<line x1="${xx}" y1="${pad.t+ch}" x2="${xx}" y2="${pad.t+ch+4}" stroke="#333" stroke-width="1"/>`;
    svg += `<text x="${xx}" y="${pad.t+ch+18}" font-size="12" text-anchor="middle">${lab}</text>`;
  });
  for(let k=0;k<=4;k++){
    const vv = minV + span*(k/4);
    const yy = y(vv);
    svg += `<line x1="${pad.l-3}" y1="${yy}" x2="${pad.l+cw}" y2="${yy}" stroke="#e0e0e0" stroke-width="1"/>`;
    svg += `<text x="${pad.l-6}" y="${yy+4}" font-size="11" text-anchor="end">${Math.round(vv)}</text>`;
  }

  if(info.type.includes('BAR')){
    const bw = cw / info.values.length * 0.6;
    info.values.forEach((v,i)=>{
      const xx = x(i) - bw/2;
      const yy = y(v);
      const hh = (pad.t+ch - yy);
      svg += `<rect x="${xx}" y="${yy}" width="${bw}" height="${hh}" fill="#2e7d32" opacity="0.8"/>`;
      svg += `<title>${info.labels[i]}: ${v}</title>`;
    });
  }else{
    const pts = info.values.map((v,i)=> `${x(i)},${y(v)}`).join(' ');
    svg += `<polyline fill="none" stroke="#2e7d32" stroke-width="2" points="${pts}"/>`;
    info.values.forEach((v,i)=>{
      svg += `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="#2e7d32"><title>${info.labels[i]}: ${v}</title></circle>`;
    });
  }
  svg += `</svg>`;
  container.innerHTML = svg;
}

// ===== Grade & Subject selection =====
document.querySelectorAll('.grade-card').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedGrade = parseInt(btn.dataset.grade,10);
    if(selectedGrade<=2){ show('viewSubjectLow','과 목 선 택'); }
    else{ show('viewSubjectHigh','과 목 선 택'); }
  });
});
document.querySelectorAll('.subject-card').forEach(btn => {
  btn.addEventListener('click', async () => {
    selectedSubject = btn.dataset.subject;
    await loadQuestions();
    startQuiz();
  });
});

// ===== Data Loading with Month Filter + Fallback =====
async function loadQuestions(){
  const path = `data/grade${selectedGrade}.json`;
  let raw = null;
  try{
    if(location.protocol === 'http:' || location.protocol === 'https:'){
      const res = await fetch(path, {cache:'no-cache'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      raw = await res.json();
    }
  }catch(e){
    console.warn('[fetch failed]', e);
  }
  if(!Array.isArray(raw)){
    notify('데이터 로드 실패: JSON 파일을 직접 선택하세요.');
    try{ raw = await pickLocalJson(); }
    catch(e){ console.error('local pick failed', e); raw = []; }
  }

  const pool = raw.filter(q => String(q.subject).trim() === String(selectedSubject).trim());
  const month = resolveTargetMonth();
  const allowed = getAllowedUnitsForMonth(month);
  const filtered = (allowed === 'all') ? pool : pool.filter(q => {
    const u = extractUnitNo(q);
    return u != null && allowed.includes(u);
  });
  const mapped = filtered.map(q => ({
    id: `${q.grade}-${q.subject}-${q.unit}-${q.number}`,
    grade: q.grade,
    subject: q.subject,
    unit: q.unit_display || q.unit,
    question: q.stem,
    choices: q.choices,
    answer: (q.answer_text && String(q.answer_text).trim()) || (q.choices && q.choices[q.answer_index]) || "",
    explanation: q.explanation || "",
    figure: null,
    graph: null,
    unit_no: extractUnitNo(q),
    meta: q.meta || null
  }));
  questions = shuffle(mapped).slice(0, 20);
}

// ===== Quiz Flow =====
function startQuiz(){
  idx = 0; correct = 0;
  show('viewQuiz', `${selectedGrade}학년 ${selectedSubject}`);
  if(questions.length === 0){
    $('#questionText').textContent = '해당 학년/과목 데이터가 아직 없어요.';
    $('#choicesWrap').innerHTML = `<button class="choice-btn" onclick="location.reload()">처음으로</button>`;
    $('#figureBox').textContent = '데이터 준비 중';
    $('#progress').textContent = `0 / 0`;
    return;
  }
  renderQuiz();
}

function renderQuiz(){
  if(idx >= questions.length){
    $('#questionText').textContent = `끝! 정답 ${correct}/${questions.length}`;
    $('#choicesWrap').innerHTML = `<button class="choice-btn" onclick="location.reload()">처음으로</button>`;
    $('#figureBox').textContent = '수고했어요!';
    $('#progress').textContent = `${questions.length} / ${questions.length}`;
    return;
  }
  const q = questions[idx];
  const fig = $('#figureBox');
  const ginfo = parseGraphMeta(q.meta);
  if(ginfo){ renderGraphSVG(fig, ginfo); }
  else { fig.textContent = '그래프나 도형(포함된다면)'; }
  $('#questionText').textContent = q.question;

  const wrongs = shuffle(q.choices.filter(c => String(c).trim() !== String(q.answer).trim())).slice(0,3);
  const choiceSet = shuffle([q.answer, ...wrongs]);

  $('#choicesWrap').innerHTML = choiceSet.map(choice =>
    `<button class="choice-btn" data-choice="${choice}">${choice}</button>`
  ).join('');

  document.querySelectorAll('.choice-btn').forEach(b => {
    b.addEventListener('click', () => checkAnswer(b.dataset.choice, q));
  });

  $('#progress').textContent = `${idx+1} / ${questions.length}`;
}

function checkAnswer(choice, q){
  const isCorrect = String(choice).trim() === String(q.answer).trim();
  if(isCorrect) correct++;
  openModal(isCorrect, q);
}

// ===== Modal & Timer =====
function openModal(isCorrect, q){
  const modal = $('#answerModal');
  $('#modalBadge').textContent = isCorrect ? '정답' : '오답';
  $('#modalAnswer').textContent = `정답: ${q.answer}`;
  $('#modalExplain').textContent = q.explanation || '해설이 제공되지 않았습니다.';
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');

  startTimer(10, () => {
    closeModal();
    idx++; renderQuiz();
  });
  $('#btnNext').onclick = () => {
    stopTimer();
    closeModal();
    idx++; renderQuiz();
  };
}
function closeModal(){
  const modal = $('#answerModal');
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden','true');
}
function startTimer(seconds, onEnd){
  stopTimer();
  timerLeft = seconds;
  $('#timerText').textContent = String(timerLeft);
  $('#timerBar').style.width = '0%';
  const total = seconds;
  timerId = setInterval(() => {
    timerLeft -= 1;
    $('#timerText').textContent = String(Math.max(0,timerLeft));
    const progress = (1 - (timerLeft/total)) * 100;
    $('#timerBar').style.width = progress + '%';
    if(timerLeft <= 0){
      stopTimer();
      onEnd && onEnd();
    }
  }, 1000);
}
function stopTimer(){ if(timerId){ clearInterval(timerId); timerId = null; } }
