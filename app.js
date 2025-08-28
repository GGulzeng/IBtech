
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

// ===== Data Loading with Month Filter =====
async function loadQuestions(){
  // Try external JSON at /data/grade{n}.json (4학년 파일 제공됨)
  const path = `data/grade${selectedGrade}.json`;
  try{
    const res = await fetch(path, {cache:'no-cache'});
    if(!res.ok) throw new Error('no data');
    const raw = await res.json(); // expected: array of objects
    // filter by subject
    const pool = raw.filter(q => String(q.subject).trim() === String(selectedSubject).trim());
    // month-based filter
    const month = resolveTargetMonth();
    const allowed = getAllowedUnitsForMonth(month);
    const filtered = (allowed === 'all') ? pool : pool.filter(q => {
      const u = extractUnitNo(q);
      return u != null && allowed.includes(u);
    });
    // map to internal format
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
      unit_no: extractUnitNo(q)
    }));
    questions = shuffle(mapped).slice(0, 20);
  }catch(e){
    // Fallback: no data
    questions = [];
  }
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
  fig.textContent = '그래프나 도형(포함된다면)';
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
