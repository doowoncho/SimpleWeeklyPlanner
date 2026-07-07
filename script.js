(function(){
"use strict";

const ALL_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

let DAYS = [...ALL_DAYS];
let START_HOUR = 5;
let END_HOUR = 24;


let ROW_H = 56;
const SNAP = 15;
const STORAGE_KEY = 'modularWeeklyPlannerTasks_v1';
const SETTINGS_KEY = 'plannerSettings_v1';
let totalHeight = 0;

function loadSettings(){
  const saved = localStorage.getItem(SETTINGS_KEY);

  if(saved){
    const s = JSON.parse(saved);
    DAYS = s.days || ALL_DAYS;
    START_HOUR = s.startHour ?? 5;
    END_HOUR = s.endHour ?? 24;
  }
}

const COLORS = [
    { id:'red',    fill:'#f6cfcb', stroke:'#e4362b', name:'Red' },
    { id:'blue',   fill:'#cdd8f7', stroke:'#1e4fd8', name:'Blue' },
    { id:'yellow', fill:'#fbe9b3', stroke:'#c99a10', name:'Yellow' },
    { id:'green',  fill:'#cfe8da', stroke:'#1e7a4c', name:'Green' },
    { id:'grey',   fill:'#e4e3de', stroke:'#59574f', name:'Grey' },
];
const colorMap = Object.fromEntries(COLORS.map(c=>[c.id,c]));


function saveSettings(){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    days: DAYS,
    startHour: START_HOUR,
    endHour: END_HOUR
  }));
}


loadSettings();
let tasks = loadTasks();
let selectedColor = COLORS[0].id;
let selectedDays = new Set();
let editingTask = null;

// ---- Undo / Redo history ----
let past = [];
let future = [];
const HISTORY_LIMIT = 50;

function snapshot(){
    return JSON.parse(JSON.stringify(tasks));
}

function recordHistory(){
    past.push(snapshot());
    if(past.length > HISTORY_LIMIT) past.shift();
    future = []; // any new action invalidates redo history
}

function undo(){
    if(past.length === 0) return;
    future.push(snapshot());
    tasks = past.pop();
    saveTasks();
    render();
}

function redo(){
    if(future.length === 0) return;
    past.push(snapshot());
    tasks = future.pop();
    saveTasks();
    render();
}

function loadTasks(){
    try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return [];
    return JSON.parse(raw);
    }catch(e){ console.warn('Could not load tasks', e); return []; }
}
function saveTasks(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
function uuid(){
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{
    const r = Math.random()*16|0, v = c==='x'?r:(r&0x3|0x8);
    return v.toString(16);
    });
}
function timeToMinutes(t){ const [h,m] = t.split(':').map(Number); return h*60+m; }
function minutesToTimeInput(mins){
    const h = Math.floor(mins/60), m = mins%60;
    return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
}
function minutesTo24(mins){
    const h = Math.floor(mins/60), m = mins%60;
    return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
}
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function snapMinutes(mins){ return Math.round(mins/SNAP)*SNAP; }

const gridEl = document.getElementById('grid');

function buildGrid(){
    totalHeight = (END_HOUR - START_HOUR) * ROW_H;
    gridEl.innerHTML = '';
    const gutter = document.createElement('div');
    gutter.className = 'time-gutter';
    const gHead = document.createElement('div');
    gHead.className = 'head-cell';
    gutter.appendChild(gHead);
    for(let h=START_HOUR; h<END_HOUR; h++){
    const lbl = document.createElement('div');
    lbl.className = 'time-label';
    const idx = document.createElement('div');
    idx.className = 'idx';
    // idx.textContent = String(h-START_HOUR+1).padStart(2,'0');
    const clock = document.createElement('div');
    clock.className = 'clock';
    clock.textContent = minutesTo24(h*60);
    lbl.appendChild(idx);
    lbl.appendChild(clock);
    gutter.appendChild(lbl);
    }
    gridEl.appendChild(gutter);

    const jsDay = new Date().getDay();
    const todayIdx = jsDay===0 ? 6 : jsDay-1;

    DAYS.forEach((d, idx)=>{
    const col = document.createElement('div');
    col.className = 'day-col';
    col.dataset.day = idx;

    const head = document.createElement('div');
    head.className = 'day-head' + (idx===todayIdx ? ' is-today':'');
    head.innerHTML = '<div class="num">'+'</div><div class="name">'+d+'</div>';
    col.appendChild(head);

    const body = document.createElement('div');
    body.className = 'day-body';
    body.style.height = totalHeight+'px';
    body.dataset.day = idx;
    col.appendChild(body);

    gridEl.appendChild(col);
    });

    updateNowLine();
}

function dayBodies(){ return Array.from(gridEl.querySelectorAll('.day-body')); }

function updateNowLine(){
    document.querySelectorAll('.now-line').forEach(n=>n.remove());
    const now = new Date();
    const mins = now.getHours()*60 + now.getMinutes();
    if(mins < START_HOUR*60 || mins > END_HOUR*60) return;
    const jsDay = now.getDay();
    const todayIdx = jsDay===0 ? 6 : jsDay-1;
    const body = gridEl.querySelector('.day-body[data-day="'+todayIdx+'"]');
    if(!body) return;
    const line = document.createElement('div');
    line.className = 'now-line';
    line.style.top = ((mins - START_HOUR*60)/60*ROW_H) + 'px';
    body.appendChild(line);
}
setInterval(updateNowLine, 60000);

function render(){
    dayBodies().forEach(b=>{
    b.querySelectorAll('.task').forEach(t=>t.remove());
    b.querySelectorAll('.empty-hint').forEach(t=>t.remove());
    });

    if(tasks.length===0){
    const body = gridEl.querySelector('.day-body[data-day="0"]');
    if(body){
        const hint = document.createElement('div');
        hint.className = 'empty-hint';
        hint.textContent = 'Double click or "ADD TASK" to begin';
        body.appendChild(hint);
    }
    }

    tasks.forEach(t=>{
    const body = gridEl.querySelector('.day-body[data-day="'+t.day+'"]');
    if(!body) return;
    body.appendChild(buildCard(t));
    });
}

function buildCard(t){
    const c = colorMap[t.color] || COLORS[0];
    const el = document.createElement('div');
    el.className = 'task';
    el.dataset.id = t.id;
    const top = (t.start - START_HOUR*60)/60*ROW_H;
    const height = (t.end - t.start)/60*ROW_H;
    el.style.top = top+'px';
    el.style.height = Math.max(height, 20)+'px';
    el.style.background = c.fill;
    el.style.borderColor = c.stroke;

    const sameGroup = t.groupId ? tasks.filter(x=>x.groupId===t.groupId) : null;
    const seriesCount = sameGroup ? sameGroup.length : 1;

    el.innerHTML =
    '<div class="del-x" title="Delete">&#10005;</div>' +
    '<div class="t-title"></div>' +
    '<div class="t-time"></div>' +
    (t.notes ? '<div class="t-notes"></div>' : '') +
    '<div class="resize-handle"></div>';

    el.querySelector('.t-title').textContent = t.title;
    el.querySelector('.t-time').textContent = minutesTo24(t.start)+'—'+minutesTo24(t.end);
    if(t.notes) el.querySelector('.t-notes').textContent = t.notes;

    attachCardInteractions(el, t);
    return el;
}

function attachCardInteractions(el, task){
    const isMobile = window.matchMedia("(pointer: coarse)").matches;
    console.log(isMobile);
    if(isMobile)return; // Disable drag/resize on mobile for now

    let mode = null;
    let startY=0, startX=0, startTop=0, startHeight=0;
    let currentBody = null;
    let moved = false;

    const del = el.querySelector('.del-x');
    del.addEventListener('pointerdown', e => e.stopPropagation());
    del.addEventListener('click', e => { e.stopPropagation(); deleteTaskFlow(task); });

    const handle = el.querySelector('.resize-handle');

    // 1. Move the movement logic into a standalone function
    function onPointerMove(e) {
    if(!mode) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if(Math.abs(dx)>3 || Math.abs(dy)>3) moved = true;

    if(mode === 'move') {
        const under = document.elementFromPoint(e.clientX, e.clientY);
        const body = under ? under.closest('.day-body') : null;
        
        if(body && body !== currentBody){
        document.querySelectorAll('.day-col').forEach(c => c.classList.remove('drop-hover'));
        body.closest('.day-col').classList.add('drop-hover');
        }
        
        const targetBody = body || currentBody;
        let newTop = startTop + dy;
        newTop = clamp(newTop, 0, totalHeight - parseFloat(el.style.height));
        
        // Reparenting here no longer breaks the drag
        if(targetBody !== el.parentElement){
        targetBody.appendChild(el);
        }
        el.style.top = newTop + 'px';

    } else if(mode === 'resize') {
        let newHeight = startHeight + dy;
        newHeight = clamp(newHeight, SNAP/60*ROW_H, totalHeight - parseFloat(el.style.top));
        el.style.height = newHeight + 'px';
    }
    }

    // 2. Move the drop logic into a standalone function
    function onPointerUp(e) {
    if(!mode) return;
    document.querySelectorAll('.day-col').forEach(c => c.classList.remove('drop-hover'));

    if(moved) recordHistory();

    if(mode === 'move') {
        const body = el.parentElement;
        const newDay = parseInt(body.dataset.day, 10);
        let newTopMin = snapMinutes(START_HOUR*60 + (parseFloat(el.style.top)/ROW_H*60));
        const duration = task.end - task.start;
        newTopMin = clamp(newTopMin, START_HOUR*60, END_HOUR*60 - duration);
        task.day = newDay;
        task.start = newTopMin;
        task.end = newTopMin + duration;
    } else if(mode === 'resize') {
        const newHeightMin = snapMinutes(parseFloat(el.style.height)/ROW_H*60);
        task.end = clamp(task.start + Math.max(newHeightMin, SNAP), task.start+SNAP, END_HOUR*60);
    }

    saveTasks();
    mode = null;
    el.classList.remove('dragging');

    // 3. Clean up the document listeners
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);

    if(!moved){
        openEditModal(task);
    } else {
        render();
    }
    }

    // 4. Attach temporary document listeners on interaction
    el.addEventListener('pointerdown', (e) => {
    if(e.target === handle) return;
    if(e.target === del) return;
    
    e.preventDefault(); // Prevents accidental text-highlighting while dragging
    mode = 'move';
    moved = false;
    startY = e.clientY; startX = e.clientX;
    startTop = parseFloat(el.style.top);
    currentBody = el.parentElement;
    el.classList.add('dragging');
    
    // Bind globally instead of using setPointerCapture
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    });

    handle.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    mode = 'resize';
    moved = false;
    startY = e.clientY;
    startHeight = parseFloat(el.style.height);
    
    // Bind globally instead of using setPointerCapture
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    });
}

const overlay = document.getElementById('modalOverlay');
const form = document.getElementById('taskForm');
const modalTitleEl = document.getElementById('modalTitle');
const dayPickerEl = document.getElementById('dayPicker');
const dayPickerLabel = document.getElementById('dayPickerLabel');
const colorPickerEl = document.getElementById('colorPicker');
const deleteZone = document.getElementById('deleteZone');
const seriesHint = document.getElementById('seriesHint');
document.getElementById('settingsBtn')
  .addEventListener('click', openSettings);

function buildDayPicker(multiSelectAllowed){
    dayPickerEl.innerHTML = '';
    DAYS.forEach((d, idx)=>{
    const chip = document.createElement('div');
    chip.className = 'day-chip' + (selectedDays.has(idx) ? ' active':'');
    chip.textContent = d[0];
    chip.title = d;
    chip.addEventListener('click', ()=>{
        if(multiSelectAllowed){
        if(selectedDays.has(idx)) selectedDays.delete(idx); else selectedDays.add(idx);
        } else {
        selectedDays = new Set([idx]);
        }
        buildDayPicker(multiSelectAllowed);
    });
    dayPickerEl.appendChild(chip);
    });
}

function buildColorPicker(){
    colorPickerEl.innerHTML = '';
    COLORS.forEach(c=>{
    const dot = document.createElement('div');
    dot.className = 'color-dot' + (selectedColor===c.id ? ' active':'');
    dot.style.background = c.fill;
    dot.style.borderColor = c.stroke;
    dot.title = c.name;
    dot.addEventListener('click', ()=>{ selectedColor = c.id; buildColorPicker(); });
    colorPickerEl.appendChild(dot);
    });
}

function buildLegend(){
    const legend = document.getElementById('legend');
    legend.innerHTML = COLORS.map(c=>
    '<span><i style="background:'+c.fill+';border-color:'+c.stroke+'"></i>'+c.name+'</span>'
    ).join('');
}

function openAddModal(prefillDay, prefillStart){
    editingTask = null;
    modalTitleEl.textContent = 'New Task';
    dayPickerLabel.textContent = "Day(s) — select multiple to repeat";
    document.getElementById('f-title').value = '';
    document.getElementById('f-notes').value = '';
    selectedColor = COLORS[0].id;
    selectedDays = new Set([prefillDay!==undefined? prefillDay : 0]);
    const start = prefillStart!==undefined ? prefillStart : 9*60;
    document.getElementById('f-start').value = minutesToTimeInput(start);
    document.getElementById('f-end').value = minutesToTimeInput(start+60);
    buildDayPicker(true);
    buildColorPicker();
    deleteZone.innerHTML = '';
    seriesHint.style.display = 'none';
    document.getElementById('saveBtn').textContent = 'Add';
    overlay.classList.remove('hidden');
    document.getElementById('f-title').focus();
}

function openEditModal(task){
    editingTask = task;
    modalTitleEl.textContent = 'Edit Task';
    dayPickerLabel.textContent = 'Day(s) — select more days to clone this task there';
    document.getElementById('f-title').value = task.title;
    document.getElementById('f-notes').value = task.notes || '';
    selectedColor = task.color;
    selectedDays = new Set([task.day]);
    document.getElementById('f-start').value = minutesToTimeInput(task.start);
    document.getElementById('f-end').value = minutesToTimeInput(task.end);
    buildDayPicker(true);
    buildColorPicker();
    document.getElementById('saveBtn').textContent = 'Save';

    const seriesCount = task.groupId ? tasks.filter(x=>x.groupId===task.groupId).length : 1;
    deleteZone.innerHTML = '';
    const delOne = document.createElement('button');
    delOne.type='button'; delOne.className='sketch-btn small danger';
    delOne.textContent = seriesCount>1 ? 'Delete this one' : 'Delete';
    delOne.addEventListener('click', ()=>{ recordHistory(); removeTasksNoHistory([task.id]); closeModal(); });
    deleteZone.appendChild(delOne);
    if(seriesCount>1){
    const delAll = document.createElement('button');
    delAll.type='button'; delAll.className='sketch-btn small danger';
    delAll.textContent = 'Delete all in series';
    delAll.addEventListener('click', ()=>{
        recordHistory();
        const ids = tasks.filter(x=>x.groupId===task.groupId).map(x=>x.id);
        removeTasksNoHistory(ids); closeModal();
    });
    deleteZone.appendChild(delAll);
    seriesHint.style.display = 'block';
    seriesHint.textContent = 'REPEATS ON '+seriesCount+' DAYS — SAVING HERE EDITS THIS OCCURRENCE ONLY';
    } else {
    seriesHint.style.display = 'none';
    }

    overlay.classList.remove('hidden');
}

function closeModal(){ overlay.classList.add('hidden'); editingTask = null; }

function openSettings(){
  const start = prompt("Start hour (0-23)", START_HOUR);
  if(start === null) return;

  const end = prompt("End hour (1-24)", END_HOUR);
  if(end === null) return;

  const days = prompt(
    "Days to show separated by commas\nExample: Mon,Tue,Wed",
    DAYS.join(',')
  );
  if(days === null) return;

  START_HOUR = Number(start);
  END_HOUR = Number(end);
  DAYS = days.split(',').map(x=>x.trim());

  if(
  isNaN(START_HOUR) ||
  isNaN(END_HOUR) ||
  START_HOUR < 0 ||
  END_HOUR > 24 ||
  START_HOUR >= END_HOUR ||
  DAYS.length === 0
){
  alert("Invalid settings");
  return;
}

  saveSettings();

  updateRowHeight();
  buildGrid();
  render();
}

// Core removal logic without touching history (callers decide when to record)
function removeTasksNoHistory(ids){
    const idSet = new Set(ids);
    tasks = tasks.filter(t=>!idSet.has(t.id));
    saveTasks();
    render();
}

function removeTasks(ids){
    recordHistory();
    removeTasksNoHistory(ids);
}

function deleteTaskFlow(task){
    const seriesCount = task.groupId ? tasks.filter(x=>x.groupId===task.groupId).length : 1;
    if(seriesCount<=1){ removeTasks([task.id]); }
    else { openEditModal(task); }
}

document.getElementById('addBtn').addEventListener('click', ()=> openAddModal());
document.getElementById('cancelBtn').addEventListener('click', closeModal);
overlay.addEventListener('click', (e)=>{ if(e.target===overlay) closeModal(); });

document.addEventListener('keydown', (e)=>{
    if(e.key==='Escape' && !overlay.classList.contains('hidden')){ closeModal(); return; }

    const mod = e.ctrlKey || e.metaKey;
    if(!mod) return;
    const key = e.key.toLowerCase();

    if(key==='z' && !e.shiftKey){
        e.preventDefault();
        undo();
    } else if(key==='y' || (key==='z' && e.shiftKey)){
        e.preventDefault();
        redo();
    }
});

document.getElementById('clearBtn').addEventListener('click', ()=>{
    if(tasks.length===0) return;
    if(confirm('Clear the entire board? This cannot be undone.')){
    recordHistory();
    tasks = [];
    saveTasks();
    render();
    }
});

form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const title = document.getElementById('f-title').value.trim();
    if(!title) return;
    recordHistory();
    const startStr = document.getElementById('f-start').value;
    const endStr = document.getElementById('f-end').value;
    let start = timeToMinutes(startStr);
    let end = timeToMinutes(endStr);
    if(end <= start) end = start + 30;
    start = clamp(snapMinutes(start), START_HOUR*60, END_HOUR*60-15);
    end = clamp(snapMinutes(end), start+15, END_HOUR*60);
    const notes = document.getElementById('f-notes').value.trim();
    const days = Array.from(selectedDays);
    if(days.length===0) days.push(0);

    if(editingTask){
    editingTask.title = title;
    editingTask.notes = notes;
    editingTask.color = selectedColor;

    const daySet = new Set(days);

    if(daySet.size > 1){
        // give it a groupId if it doesn't already have one
        if(!editingTask.groupId) editingTask.groupId = uuid();
        const groupId = editingTask.groupId;

        // keep the edited task on its own day if still selected, else move it to the first pick
        if(!daySet.has(editingTask.day)) editingTask.day = days[0];
        editingTask.start = start;
        editingTask.end = end;

        daySet.forEach(d=>{
            if(d === editingTask.day) return;
            const existing = tasks.find(t=>t.groupId===groupId && t.day===d);
            if(existing){
                // sync the clone's fields
                Object.assign(existing, { title, notes, color: selectedColor, start, end });
            } else {
                tasks.push({ id: uuid(), groupId, day: d, start, end, title, notes, color: selectedColor });
            }
        });
    } else {
        editingTask.day = days[0];
        editingTask.start = start;
        editingTask.end = end;
    }
    } else {
    const groupId = days.length>1 ? uuid() : null;
    days.forEach(d=>{
        tasks.push({ id: uuid(), groupId: groupId, day: d, start, end, title, notes, color: selectedColor });
    });
    }
    saveTasks();
    render();
    closeModal();
});

gridEl.addEventListener('dblclick', (e)=>{
    const body = e.target.closest('.day-body');
    if(!body || e.target.closest('.task')) return;
    const rect = body.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const mins = clamp(snapMinutes(START_HOUR*60 + y/ROW_H*60), START_HOUR*60, END_HOUR*60-30);
    openAddModal(parseInt(body.dataset.day,10), mins);
});

buildGrid();
buildLegend();
render();

const boardWrap = document.querySelector('.board-wrap');
boardWrap.scrollTop = (7-START_HOUR)*ROW_H;

})();