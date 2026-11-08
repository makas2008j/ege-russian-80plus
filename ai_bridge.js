(function(){
  'use strict';
  const API='http://127.0.0.1:8000';
  const HISTORY_KEY='ege_ai_chat_history_v1';
  let history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
  let busy=false;

  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function formatAI(text){
    let s=String(text??'').replace(/\r/g,'').trim();
    if(!s) return '<div class="ai-empty">Пустой ответ.</div>';
    const lines=s.split('\n'); let html='', inCode=false, code=[];
    const inline=t=>{
      let x=esc(t);
      x=x.replace(/`([^`]+)`/g,'<code>$1</code>');
      x=x.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
      x=x.replace(/__([^_]+)__/g,'<strong>$1</strong>');
      x=x.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g,'$1<em>$2</em>');
      x=x.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
      return x;
    };
    let listType=null;
    function closeList(){if(listType){html+=`</${listType}>`;listType=null;}}
    for(let raw of lines){
      const line=raw.trimEnd();
      if(line.trim()==='```'){if(inCode){html+='<pre class="ai-code"><code>'+esc(code.join('\n'))+'</code></pre>';code=[];inCode=false;}else{closeList();inCode=true;}continue;}
      if(inCode){code.push(line);continue;}
      if(!line.trim()){closeList();html+='<div class="ai-spacer"></div>';continue;}
      let m=line.match(/^###\s+(.+)/); if(m){closeList();html+=`<h4>${inline(m[1])}</h4>`;continue;}
      m=line.match(/^##\s+(.+)/); if(m){closeList();html+=`<h3>${inline(m[1])}</h3>`;continue;}
      m=line.match(/^#\s+(.+)/); if(m){closeList();html+=`<h2>${inline(m[1])}</h2>`;continue;}
      m=line.match(/^[-*]\s+(.+)/); if(m){if(listType!=='ul'){closeList();html+='<ul>';listType='ul';}html+=`<li>${inline(m[1])}</li>`;continue;}
      m=line.match(/^\d+[.)]\s+(.+)/); if(m){if(listType!=='ol'){closeList();html+='<ol>';listType='ol';}html+=`<li>${inline(m[1])}</li>`;continue;}
      closeList();
      if(/^>\s?/.test(line)){html+=`<blockquote>${inline(line.replace(/^>\s?/,''))}</blockquote>`;continue;}
      html+=`<p>${inline(line)}</p>`;
    }
    if(inCode) html+='<pre class="ai-code"><code>'+esc(code.join('\n'))+'</code></pre>';
    closeList();
    return html;
  }

  function ensureUI(){
    const tabs=document.querySelector('.tabs');
    if(tabs && !document.getElementById('ai-tab-btn')){
      tabs.insertAdjacentHTML('beforeend','<button id="ai-tab-btn" class="tab-btn" onclick="switchTab(\'ai\',this); aiInit()">🤖 ИИ');
    }
    if(!document.getElementById('tab-ai')){
      const plan=document.getElementById('tab-plan');
      if(!plan) return;
      plan.insertAdjacentHTML('beforebegin',`
<section id="tab-ai" class="tab-content">
  <div class="ai-shell">
    <div class="ai-head">
      <div><div class="ai-title">🤖 ИИ-репетитор</div><div class="ai-subtitle">Qwen 3 8B • локально на твоём ПК</div></div>
      <div id="ai-status" class="ai-status offline">● Проверка...</div>
    </div>
    <div class="ai-tools">
      <button class="ai-tool active" onclick="aiMode('chat',this)">💬 Чат</button>
      <button class="ai-tool" onclick="aiMode('error',this)">📝 Разбор ошибки</button>
      <button class="ai-tool" onclick="aiMode('task',this)">🎯 Задание</button>
      <button class="ai-tool" onclick="aiMode('progress',this)">📊 Прогресс</button>
      <button class="ai-tool" onclick="aiMode('rule',this)">📚 Правило</button>
    </div>

    <div id="ai-mode-chat" class="ai-mode active">
      <div id="ai-messages" class="ai-messages"></div>
      <div class="ai-compose"><textarea id="ai-input" rows="2" placeholder="Напиши вопрос по русскому языку..." onkeydown="aiEnter(event)"></textarea><button class="ai-send" onclick="aiSend()">➤</button></div>
      <div class="ai-hint">Enter — отправить • Shift+Enter — новая строка</div>
    </div>

    <div id="ai-mode-error" class="ai-mode"><div class="ai-form">
      <label>№ задания <input id="ai-error-task" type="number" min="1" max="26" placeholder="Например, 9"></label>
      <label>Что написал ты <textarea id="ai-error-student" rows="3" placeholder="Твой ответ или ход решения"></textarea></label>
      <label>Правильный ответ <textarea id="ai-error-correct" rows="2" placeholder="Если знаешь"></textarea></label>
      <label>Условие / контекст <textarea id="ai-error-context" rows="4" placeholder="Вставь условие задания"></textarea></label>
      <button class="btn-main" onclick="aiAnalyzeError()">Разобрать ошибку</button>
    </div><div id="ai-error-result" class="ai-result"></div></div>

    <div id="ai-mode-task" class="ai-mode"><div class="ai-form">
      <label>№ задания <select id="ai-task-num"><option>1</option><option>2</option><option>7</option><option>8</option><option>9</option><option>10</option><option>11</option><option>12</option><option>13</option><option>14</option><option>15</option><option>16</option><option>17</option><option>18</option><option>19</option><option>20</option><option>21</option><option>22</option><option>23</option><option>24</option><option>25</option><option>26</option></select></label>
      <label>Тема <input id="ai-task-topic" placeholder="Например: правописание корней"></label>
      <label>Сложность <select id="ai-task-diff"><option>средняя</option><option>лёгкая</option><option>сложная</option></select></label>
      <button class="btn-main" onclick="aiGenerateTask()">Сгенерировать задание</button>
    </div><div id="ai-task-result" class="ai-result"></div></div>

    <div id="ai-mode-progress" class="ai-mode"><div id="ai-progress-card" class="ai-progress-card"></div><button class="btn-main" onclick="aiAnalyzeProgress()">📊 Проанализировать мой прогресс</button><div id="ai-progress-result" class="ai-result"></div></div>

    <div id="ai-mode-rule" class="ai-mode"><div class="ai-form"><label>Что объяснить <textarea id="ai-rule" rows="4" placeholder="Например: Н и НН в причастиях"></textarea></label><button class="btn-main" onclick="aiExplainRule()">Объяснить правило</button></div><div id="ai-rule-result" class="ai-result"></div></div>

    <div class="ai-footer"><button onclick="aiClearHistory()" class="ai-link">Очистить историю чата</button><span>История хранится только в браузере.</span></div>
  </div>
</section>`);
    }
    renderHistory(); renderProgressCard(); checkStatus();
  }

  async function post(path, body){
    const r=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    let data={}; try{data=await r.json();}catch(e){throw new Error('Bridge вернул некорректный ответ.');}
    if(!r.ok || data.ok===false) throw new Error(data.error||data.message||`Ошибка ${r.status}`);
    return data;
  }
  async function checkStatus(){
    const el=document.getElementById('ai-status'); if(!el)return;
    try{const r=await fetch(API+'/api/status',{cache:'no-store'});const d=await r.json();
      if(d.ok){el.textContent='● Онлайн';el.className='ai-status online';} else {el.textContent='● Ошибка';el.className='ai-status offline';}
    }catch(e){el.textContent='● Запусти AI';el.className='ai-status offline';}
  }
  function addHistory(role,content){history.push({role,content,ts:Date.now()});history=history.slice(-60);localStorage.setItem(HISTORY_KEY,JSON.stringify(history));}
  function renderHistory(){const el=document.getElementById('ai-messages');if(!el)return;el.innerHTML='';if(!history.length){el.innerHTML='<div class="ai-welcome"><div class="ai-welcome-icon">🤖</div><h3>Привет! Я твой ИИ-репетитор</h3><p>Можешь спросить правило, прислать ошибку, попросить задание или разобрать свой прогресс.</p></div>';return;}history.forEach(m=>{const d=document.createElement('div');d.className='ai-msg '+(m.role==='user'?'user':'assistant');d.innerHTML=`<div class="ai-bubble">${m.role==='assistant'?formatAI(m.content):esc(m.content).replace(/\n/g,'<br>')}</div>`;el.appendChild(d);});el.scrollTop=el.scrollHeight;}
  function setResult(id,text){const el=document.getElementById(id);if(el)el.innerHTML=formatAI(text);}
  async function ask(prompt){return (await post('/api/chat',{message:prompt})).response||'';}
  window.aiInit=ensureUI;
  window.aiMode=function(mode,btn){ensureUI();document.querySelectorAll('.ai-mode').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.ai-tool').forEach(x=>x.classList.remove('active'));const el=document.getElementById('ai-mode-'+mode);if(el)el.classList.add('active');if(btn)btn.classList.add('active');if(mode==='progress')renderProgressCard();checkStatus();};
  window.aiEnter=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();aiSend();}};
  window.aiSend=async function(){if(busy)return;const input=document.getElementById('ai-input');const msg=(input?.value||'').trim();if(!msg)return;busy=true;input.value='';addHistory('user',msg);renderHistory();const typing={role:'assistant',content:'⏳ Думаю...'};history.push(typing);renderHistory();try{const prompt=`Ты ИИ-репетитор по русскому языку для подготовки к ЕГЭ. Отвечай на русском. Объясняй понятно, по шагам. Используй Markdown: заголовки, **жирный**, списки и примеры. Не выдавай авторские задания за официальные ФИПИ.\n\nВопрос ученика:\n${msg}`;const ans=await ask(prompt);history.pop();addHistory('assistant',ans);renderHistory();}catch(e){history.pop();addHistory('assistant','**Ошибка подключения**\n\n'+e.message+'\n\nПроверь, что `start_ai.bat` запущен на компьютере.');renderHistory();}finally{busy=false;}};
  window.aiAnalyzeError=async function(){const task=document.getElementById('ai-error-task').value,student=document.getElementById('ai-error-student').value,correct=document.getElementById('ai-error-correct').value,ctx=document.getElementById('ai-error-context').value;if(!student&&!ctx)return setResult('ai-error-result','Напиши хотя бы свой ответ или условие задания.');setResult('ai-error-result','⏳ Разбираю...');try{const ans=await ask(`Разбери ошибку ученика на ЕГЭ по русскому. Задание №${task||'не указано'}. Условие: ${ctx||'не указано'}. Ответ ученика: ${student||'не указано'}. Правильный ответ: ${correct||'не указан'}.\n\nФормат: ## Где ошибка\n## Почему\n## Правило\n## Как запомнить\n## Мини-тренировка\nСделай объяснение конкретным и понятным.`);setResult('ai-error-result',ans);}catch(e){setResult('ai-error-result','**Ошибка:** '+e.message);}};
  window.aiGenerateTask=async function(){const n=document.getElementById('ai-task-num').value,t=document.getElementById('ai-task-topic').value,d=document.getElementById('ai-task-diff').value;setResult('ai-task-result','⏳ Генерирую...');try{const ans=await ask(`Создай одно авторское тренировочное задание ЕГЭ по русскому языку №${n}. Тема: ${t||'выбери подходящую для этого номера'}. Сложность: ${d}. Дай условие, 4 варианта ответа если формат подходит, затем отдельным блоком правильный ответ и подробное объяснение. Не называй его официальным заданием ФИПИ.`);setResult('ai-task-result',ans);}catch(e){setResult('ai-task-result','**Ошибка:** '+e.message);}};
  function renderProgressCard(){const el=document.getElementById('ai-progress-card');if(!el)return;const weeks=Object.values(JSON.parse(localStorage.getItem('ege_completed_weeks')||'{}')).filter(Boolean).length;const errors=JSON.parse(localStorage.getItem('ege_user_errors')||'[]');const tests=JSON.parse(localStorage.getItem('ege_test_history')||'[]');el.innerHTML=`<div class="ai-stat"><b>${weeks}</b><span>из 28 недель</span></div><div class="ai-stat"><b>${errors.length}</b><span>ошибок</span></div><div class="ai-stat"><b>${tests.length}</b><span>тестов</span></div>`;}
  window.aiAnalyzeProgress=async function(){const weeks=Object.values(JSON.parse(localStorage.getItem('ege_completed_weeks')||'{}')).filter(Boolean).length;const errors=JSON.parse(localStorage.getItem('ege_user_errors')||'[]');const tests=JSON.parse(localStorage.getItem('ege_test_history')||'[]');setResult('ai-progress-result','⏳ Анализирую...');try{const ans=await ask(`Проанализируй прогресс ученика по ЕГЭ Русский. Пройдено недель: ${weeks}/28. Ошибки: ${JSON.stringify(errors.slice(0,20))}. История тестов: ${JSON.stringify(tests.slice(0,20))}. Дай оценку текущего состояния, 3 главных слабых места и план на ближайшую неделю. Не выдумывай данные, которых нет.`);setResult('ai-progress-result',ans);}catch(e){setResult('ai-progress-result','**Ошибка:** '+e.message);}};
  window.aiExplainRule=async function(){const q=document.getElementById('ai-rule').value.trim();if(!q)return;setResult('ai-rule-result','⏳ Объясняю...');try{const ans=await ask(`Объясни ученику правило русского языка: ${q}. Уровень ученика низкий. Объясни простыми словами, дай алгоритм, 3 примера и 3 мини-вопроса для самопроверки. Используй Markdown.`);setResult('ai-rule-result',ans);}catch(e){setResult('ai-rule-result','**Ошибка:** '+e.message);}};
  window.aiClearHistory=function(){history=[];localStorage.removeItem(HISTORY_KEY);renderHistory();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureUI);else ensureUI();
})();
