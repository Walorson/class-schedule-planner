import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Download, Upload, Trash2, X, ChevronUp, ChevronDown, Clock3, CalendarDays } from 'lucide-react';

const DAYS = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek'];
const START_HOUR = 7;
const END_HOUR = 21;
const SLOTS = (END_HOUR - START_HOUR) * 4;
const SLOT_HEIGHT = 18;
type Kind = 'Wykład' | 'Ćwiczenia' | 'Laboratorium' | 'Lektorat';
type Lesson = { id: string; day: number; start: number; duration: number; name: string; instructor: string; kind: Kind; room: string; color: string };
const COLORS = ['blue', 'violet', 'mint', 'amber', 'rose'];
const emptyLesson = (day: number, start: number): Lesson => ({ id: crypto.randomUUID(), day, start, duration: 6, name: 'Nowe zajęcia', instructor: '', kind: 'Laboratorium', room: '', color: COLORS[Math.floor(Math.random() * COLORS.length)] });
const toTime = (slot: number) => { const total = START_HOUR * 60 + slot * 15; return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; };
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export default function App() {
  const [lessons, setLessons] = useState<Lesson[]>(() => {
    try { return JSON.parse(localStorage.getItem('plan-zajec-v1') || '[]') as Lesson[]; } catch { return []; }
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Lesson | null>(null);
  const [notice, setNotice] = useState('');
  const drag = useRef<{ id: string; y: number; start: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const selectedLesson = lessons.find(l => l.id === selected) ?? null;
  useEffect(() => { localStorage.setItem('plan-zajec-v1', JSON.stringify(lessons)); }, [lessons]);
  const sorted = useMemo(() => [...lessons].sort((a,b) => a.day-b.day || a.start-b.start), [lessons]);

  function overlaps(candidate: Lesson, ignoreId = candidate.id) {
    return lessons.some(l => l.id !== ignoreId && l.day === candidate.day && candidate.start < l.start + l.duration && candidate.start + candidate.duration > l.start);
  }
  function addLesson(day: number, start: number) {
    const candidate = emptyLesson(day, start);
    if (candidate.start + candidate.duration > SLOTS) candidate.start = SLOTS - candidate.duration;
    if (overlaps(candidate, '')) { setNotice('W tym miejscu są już zajęcia. Wybierz inny przedział.'); return; }
    setLessons(prev => [...prev, candidate]); setSelected(candidate.id); setDraft(candidate);
  }
  function updateLesson(id: string, changes: Partial<Lesson>) {
    setLessons(prev => prev.map(l => l.id === id ? { ...l, ...changes } : l));
  }
  function moveBy(id: string, delta: number) {
    const lesson = lessons.find(l => l.id === id); if (!lesson) return;
    const next = { ...lesson, start: clamp(lesson.start + delta, 0, SLOTS - lesson.duration) };
    if (!overlaps(next)) updateLesson(id, { start: next.start }); else setNotice('Nie można nałożyć zajęć na inny blok.');
  }
  function resize(id: string, delta: number) {
    const lesson = lessons.find(l => l.id === id); if (!lesson) return;
    const duration = clamp(lesson.duration + delta, 1, SLOTS - lesson.start);
    const next = { ...lesson, duration };
    if (!overlaps(next)) updateLesson(id, { duration }); else setNotice('Blok nie może nachodzić na inne zajęcia.');
  }
  function beginDrag(e: React.PointerEvent, lesson: Lesson) {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: lesson.id, y: e.clientY, start: lesson.start };
  }
  function onDrag(e: React.PointerEvent) {
    if (!drag.current) return;
    const delta = Math.round((e.clientY - drag.current.y) / SLOT_HEIGHT);
    const lesson = lessons.find(l => l.id === drag.current!.id); if (!lesson) return;
    const start = clamp(drag.current.start + delta, 0, SLOTS - lesson.duration);
    const next = { ...lesson, start };
    if (!overlaps(next)) updateLesson(lesson.id, { start });
  }
  function exportPlan() {
    const blob = new Blob([JSON.stringify(lessons, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'moj-plan-zajec.json'; a.click(); URL.revokeObjectURL(url);
  }
  function importPlan(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { const parsed = JSON.parse(String(reader.result)); if (!Array.isArray(parsed)) throw new Error(); setLessons(parsed); setNotice('Zaimportowano plan zajęć.'); } catch { setNotice('Nie udało się odczytać pliku JSON.'); } };
    reader.readAsText(file);
  }
  function saveDraft() {
    if (!draft) return;
    const clean = { ...draft, name: draft.name.trim() || 'Zajęcia' };
    if (overlaps(clean)) { setNotice('Ten blok nachodzi na inne zajęcia. Zmień godzinę lub długość.'); return; }
    setLessons(prev => prev.map(l => l.id === clean.id ? clean : l)); setSelected(clean.id); setDraft(null);
  }
  function openEditor(lesson: Lesson) { setSelected(lesson.id); setDraft({ ...lesson }); }
  const editing = draft;

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-mark"><CalendarDays size={22}/></div>
      <div className="brand-copy"><div className="eyebrow">ORGANIZACJA SEMESTRU</div><h1>Plan zajęć</h1><p>Twój tydzień, uporządkowany w jednym miejscu.</p></div>
      <div className="header-actions">
        <button className="btn btn-quiet" onClick={() => fileInput.current?.click()}><Upload size={16}/> Importuj</button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={e => { importPlan(e.target.files?.[0]); e.currentTarget.value = ''; }}/>
        <button className="btn btn-primary" onClick={exportPlan}><Download size={16}/> Eksportuj plan</button>
      </div>
    </header>
    <section className="quick-info">
      <div className="info-item"><span className="info-icon"><Clock3 size={17}/></span><div><b>15 minut</b><small>Dokładność siatki</small></div></div>
      <div className="info-divider"/>
      <div className="info-item"><span className="dot dot-blue"/><div><b>{lessons.length} {lessons.length === 1 ? 'blok' : 'bloków'}</b><small>W tym tygodniu</small></div></div>
      <div className="quick-hint">Kliknij siatkę, aby dodać zajęcia <span>↗</span></div>
    </section>
    {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Zamknij komunikat"><X size={15}/></button></div>}
    <section className="planner-card">
      <div className="planner-heading"><div><h2>Twój harmonogram</h2><p>Przeciągnij blok, aby zmienić godzinę. Złap dolną krawędź, aby zmienić czas trwania.</p></div><div className="legend"><span className="legend-dot blue"/>Zajęcia <span className="legend-line"/>15 min</div></div>
      <div className="timetable-scroll">
        <div className="timetable" style={{'--slot-height': `${SLOT_HEIGHT}px`} as React.CSSProperties}>
          <div className="corner-cell"><span>GODZ.</span></div>
          {DAYS.map(day => <div className="day-heading" key={day}>{day}</div>)}
          <div className="time-column">{Array.from({length: SLOTS}, (_, i) => <div className={`time-cell ${i % 4 === 0 ? 'hour-start' : ''}`} key={i}>{i % 4 === 0 ? <strong>{START_HOUR + i / 4}</strong> : null}<span>{['00–15','15–30','30–45','45–60'][i % 4]}</span></div>)}</div>
          {DAYS.map((day, dayIndex) => <div className="day-column" key={day}>
            {Array.from({length: SLOTS}, (_, slot) => <button key={slot} className={`grid-slot ${slot % 4 === 0 ? 'hour-line' : ''}`} aria-label={`Dodaj zajęcia: ${day}, ${toTime(slot)}`} title={`${toTime(slot)} — kliknij, aby dodać`} onClick={() => addLesson(dayIndex, slot)} />)}
            {sorted.filter(l => l.day === dayIndex).map(lesson => <article key={lesson.id} className={`lesson-block ${lesson.color} ${selected === lesson.id ? 'is-selected' : ''}`} style={{ top: lesson.start * SLOT_HEIGHT, height: lesson.duration * SLOT_HEIGHT }} onPointerDown={e => beginDrag(e, lesson)} onPointerMove={onDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onDoubleClick={() => openEditor(lesson)} title="Przeciągnij, aby przesunąć • kliknij dwukrotnie, aby edytować">
              <button className="block-edit" onClick={e => { e.stopPropagation(); openEditor(lesson); }} aria-label="Edytuj zajęcia"><span>✎</span></button>
              <div className="block-content" onClick={() => setSelected(lesson.id)}>
                <div className="block-title">{lesson.name}</div>
                {lesson.instructor && <div className="block-meta">{lesson.instructor}</div>}
                <div className="block-kind">{lesson.kind}</div>
                {lesson.room && <div className="block-room">s. {lesson.room}</div>}
                <div className="block-time">{toTime(lesson.start)}–{toTime(lesson.start + lesson.duration)}</div>
              </div>
              <div className="block-tools">
                <button aria-label="Przesuń o 15 minut wcześniej" title="15 min wcześniej" onClick={e => { e.stopPropagation(); moveBy(lesson.id, -1); }}><ChevronUp size={13}/></button>
                <button aria-label="Przesuń o 15 minut później" title="15 min później" onClick={e => { e.stopPropagation(); moveBy(lesson.id, 1); }}><ChevronDown size={13}/></button>
                <button aria-label="Skróć o 15 minut" title="Skróć o 15 min" onClick={e => { e.stopPropagation(); resize(lesson.id, -1); }}>−</button>
                <button aria-label="Wydłuż o 15 minut" title="Wydłuż o 15 min" onClick={e => { e.stopPropagation(); resize(lesson.id, 1); }}>+</button>
              </div>
              <div className="resize-handle" onPointerDown={e => { e.stopPropagation(); }} onClick={e => { e.stopPropagation(); resize(lesson.id, 1); }} title="Kliknij, aby wydłużyć o 15 minut"><span/></div>
            </article>)}
          </div>)}
        </div>
      </div>
      <footer className="planner-footer"><span><i className="status-dot"/> Zapis automatyczny w tej przeglądarce</span><span>07:00–21:00 <b>·</b> poniedziałek–piątek</span></footer>
    </section>
    <p className="bottom-note">Wskazówka: kliknij przycisk <b>✎</b> w bloku, aby edytować szczegóły. Zmiany zapisują się automatycznie.</p>
    {editing && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setDraft(null); }}>
      <section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <div className="modal-heading"><div><span className="modal-kicker">SZCZEGÓŁY BLOKU</span><h2 id="editor-title">Edytuj zajęcia</h2></div><button className="icon-button" onClick={() => setDraft(null)} aria-label="Zamknij"><X size={19}/></button></div>
        <div className="editor-time"><div><small>DZIEŃ</small><select value={editing.day} onChange={e => setDraft({...editing, day: Number(e.target.value)})}>{DAYS.map((d,i) => <option value={i} key={d}>{d}</option>)}</select></div><div><small>POCZĄTEK</small><select value={editing.start} onChange={e => setDraft({...editing, start: Number(e.target.value)})}>{Array.from({length:SLOTS},(_,i)=><option value={i} key={i}>{toTime(i)}</option>)}</select></div><div><small>CZAS TRWANIA</small><div className="duration-control"><button onClick={() => setDraft({...editing,duration:clamp(editing.duration-1,1,SLOTS-editing.start)})} disabled={editing.duration<=1}>−</button><b>{Math.floor(editing.duration/4)} godz. {editing.duration%4*15} min</b><button onClick={() => setDraft({...editing,duration:clamp(editing.duration+1,1,SLOTS-editing.start)})} disabled={editing.start+editing.duration>=SLOTS}>+</button></div></div></div>
        <label className="field"><span>Nazwa zajęć</span><input autoFocus value={editing.name} onChange={e => setDraft({...editing,name:e.target.value})} placeholder="np. Programowanie aplikacji"/></label>
        <label className="field"><span>Prowadzący</span><input value={editing.instructor} onChange={e => setDraft({...editing,instructor:e.target.value})} placeholder="Imię i nazwisko"/></label>
        <div className="field"><span>Rodzaj zajęć</span><div className="kind-options">{(['Wykład','Ćwiczenia','Laboratorium','Lektorat'] as Kind[]).map(kind=><button key={kind} className={editing.kind===kind?'active':''} onClick={()=>setDraft({...editing,kind})}>{kind}</button>)}</div></div>
        <div className="editor-bottom-row"><label className="field room-field"><span>Sala</span><input value={editing.room} onChange={e => setDraft({...editing,room:e.target.value})} placeholder="np. C106"/></label><label className="field color-field"><span>Kolor bloku</span><select value={editing.color} onChange={e=>setDraft({...editing,color:e.target.value})}><option value="blue">Niebieski</option><option value="violet">Fioletowy</option><option value="mint">Miętowy</option><option value="amber">Bursztynowy</option><option value="rose">Różowy</option></select></label></div>
        <div className="modal-actions"><button className="btn btn-danger" onClick={() => {setLessons(prev=>prev.filter(l=>l.id!==editing.id));setDraft(null);setSelected(null);}}><Trash2 size={16}/> Usuń blok</button><div><button className="btn btn-quiet" onClick={() => setDraft(null)}>Anuluj</button><button className="btn btn-primary" onClick={saveDraft}>Zapisz zmiany</button></div></div>
      </section>
    </div>}
  </main>;
}