import { useState, useMemo, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import './App.css';

// ─── UTILS ───────────────────────────────────────────────────────────────────

function parseDMY(str) {
  if (!str) return null;
  const s = str.trim();
  const match = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const d = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) - 1;
    const y = parseInt(match[3], 10);
    return new Date(y, m, d);
  }
  return null;
}

function formatDMY(date) {
  if (!date) return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${date.getFullYear()}`;
}

function durationDays(start, end) {
  const ms = end.getTime() - start.getTime();
  // If start == end, duration is 1 day minimum visually
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1); // Inclusive
}

function formatTick(date) {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [importError, setImportError] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [hoveredTask, setHoveredTask] = useState(null);
  
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskStart, setNewTaskStart] = useState('');
  const [newTaskEnd, setNewTaskEnd] = useState('');

  const fileInputRef = useRef(null);
  const chartRef = useRef(null);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('gantt-tasks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const hydrated = parsed.map(t => ({
          ...t,
          start: new Date(t.start),
          end: new Date(t.end)
        }));
        setTasks(hydrated);
      } catch (e) {
        console.error('Failed to parse tasks', e);
      }
    }
  }, []);

  // Save to localStorage when tasks change
  useEffect(() => {
    localStorage.setItem('gantt-tasks', JSON.stringify(tasks.map(t => ({
      ...t,
      start: t.start.getTime(),
      end: t.end.getTime()
    }))));
  }, [tasks]);

  // Handle Add Task
  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskName || !newTaskStart || !newTaskEnd) return;

    const start = new Date(newTaskStart);
    const end = new Date(newTaskEnd);

    if (end < start) {
      alert("La date de fin doit être après la date de début.");
      return;
    }

    const newTask = {
      id: `task-${Date.now()}`,
      name: newTaskName,
      start: start,
      end: end,
      originalStart: formatDMY(start),
      originalEnd: formatDMY(end)
    };

    setTasks([...tasks, newTask]);
    setNewTaskName('');
    setNewTaskStart('');
    setNewTaskEnd('');
  };

  // Handle Export Image
  const handleExportImage = async () => {
    if (!chartRef.current) return;
    try {
      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `gantt-chart-${formatDMY(new Date()).replace(/\//g, '-')}.png`;
      link.click();
    } catch (error) {
      console.error("Erreur lors de l'exportation de l'image:", error);
      alert("Une erreur est survenue lors de l'exportation.");
    }
  };

  // Handle CSV Import
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      
      if (lines.length < 2) {
        setImportError("Le fichier CSV doit contenir une ligne d'en-tête et au moins une tâche.");
        return;
      }

      const headers = lines[0].toLowerCase();
      if (!headers.includes('secteur') || !headers.includes('debut') || !headers.includes('fin')) {
        setImportError("Les en-têtes doivent contenir 'Secteur', 'date debut', 'date fin'.");
        return;
      }

      // Auto-detect delimiter
      const delim = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
      
      const newTasks = [];
      let hasError = false;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(delim).map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 3) continue;

        const name = cols[0];
        const start = parseDMY(cols[1]);
        const end = parseDMY(cols[2]);

        if (!name || !start || !end) {
          setImportError(`Erreur de format à la ligne ${i + 1}. Vérifiez les dates (jj/mm/aaaa).`);
          hasError = true;
          break;
        }

        if (end < start) {
          setImportError(`Erreur à la ligne ${i + 1}: la date de fin est avant la date de début.`);
          hasError = true;
          break;
        }

        newTasks.push({
          id: `task-${Date.now()}-${i}`,
          name,
          start,
          end,
          originalStart: cols[1],
          originalEnd: cols[2]
        });
      }

      if (!hasError) {
        setTasks(newTasks);
        setImportError('');
        setSelectedTask(null);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // Chart Calculations
  const chartData = useMemo(() => {
    if (tasks.length === 0) return null;

    const starts = tasks.map(t => t.start.getTime());
    const ends = tasks.map(t => Math.max(t.start.getTime(), t.end.getTime())); // Handle same day

    let minStart = Math.min(...starts);
    let maxEnd = Math.max(...ends);

    // Padding (1 day on each side)
    const ONE_DAY = 24 * 60 * 60 * 1000;
    minStart -= ONE_DAY;
    maxEnd += ONE_DAY;

    const totalMs = maxEnd - minStart;
    const totalDays = Math.ceil(totalMs / ONE_DAY);

    // Dynamic Tick Interval
    let tickIntervalDays = 1;
    if (totalDays > 30) tickIntervalDays = 7;
    else if (totalDays > 10) tickIntervalDays = 3;

    // Responsive: On smaller screens, we might want to scale up the tick interval if not scrolling
    // but the requirement says mobile has horizontal scroll. 

    const ticks = [];
    for (let i = 0; i <= totalDays; i += tickIntervalDays) {
      ticks.push(new Date(minStart + i * ONE_DAY));
    }

    // Dynamic Row Height Classes
    let rowHeightClass = 'h-16'; // Few tasks
    let barHeightClass = 'h-8';
    if (tasks.length > 20) {
      rowHeightClass = 'h-8'; // Compact
      barHeightClass = 'h-4';
    } else if (tasks.length > 10) {
      rowHeightClass = 'h-12'; // Medium
      barHeightClass = 'h-6';
    }

    return {
      minStart,
      maxEnd,
      totalMs,
      ticks,
      rowHeightClass,
      barHeightClass
    };
  }, [tasks]);

  const getPositionStyles = (start, end, minStart, totalMs) => {
    const s = start.getTime();
    const e = Math.max(s, end.getTime()); // Ensure end >= start
    
    // Add 1 day to end to visually include the end day fully
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const eAdjusted = e + ONE_DAY;

    const leftPct = ((s - minStart) / totalMs) * 100;
    const widthPct = ((eAdjusted - s) / totalMs) * 100;

    return {
      left: `${leftPct}%`,
      width: `${Math.max(widthPct, 0.5)}%` // Minimum width visually
    };
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  let todayPct = null;
  if (chartData && todayMs >= chartData.minStart && todayMs <= chartData.maxEnd) {
    todayPct = ((todayMs - chartData.minStart) / chartData.totalMs) * 100;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col items-center">
      
      {/* Header & Controls */}
      <div className="w-full max-w-[1400px] px-4 md:px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#007A3D] flex items-center gap-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Gantt Flow
          </h1>
          <p className="text-sm text-slate-500 font-medium ml-10">Smart Gantt Chart Generator</p>
        </div>

        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
          {tasks.length > 0 && (
            <button 
              onClick={handleExportImage}
              className="bg-white border border-[#007A3D] text-[#007A3D] hover:bg-slate-50 px-5 py-2.5 rounded-lg font-semibold shadow-sm transition-all flex items-center gap-2 transform active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Exporter PNG
            </button>
          )}
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current.click()}
            className="bg-[#007A3D] hover:bg-[#005C2E] text-white px-5 py-2.5 rounded-lg font-semibold shadow-md transition-all flex items-center gap-2 transform active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Importer CSV
          </button>
          {importError && (
            <div className="w-full sm:w-auto">
              <p className="text-red-500 text-xs font-semibold bg-red-50 px-2 py-1 rounded border border-red-200 mt-2 sm:mt-0">{importError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Task Form */}
      <div className="w-full max-w-[1400px] px-4 md:px-8 mb-6">
        <form onSubmit={handleAddTask} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-end">
          <div className="flex flex-col flex-grow w-full md:w-auto">
            <label className="text-xs font-semibold text-slate-500 mb-1">Nom de la tâche</label>
            <input 
              type="text" 
              value={newTaskName} 
              onChange={(e) => setNewTaskName(e.target.value)} 
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#007A3D] focus:ring-1 focus:ring-[#007A3D]"
              placeholder="Ex: Phase de test..."
              required
            />
          </div>
          <div className="flex flex-col w-full md:w-auto">
            <label className="text-xs font-semibold text-slate-500 mb-1">Date de début</label>
            <input 
              type="date" 
              value={newTaskStart} 
              onChange={(e) => setNewTaskStart(e.target.value)} 
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#007A3D] focus:ring-1 focus:ring-[#007A3D]"
              required
            />
          </div>
          <div className="flex flex-col w-full md:w-auto">
            <label className="text-xs font-semibold text-slate-500 mb-1">Date de fin</label>
            <input 
              type="date" 
              value={newTaskEnd} 
              onChange={(e) => setNewTaskEnd(e.target.value)} 
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#007A3D] focus:ring-1 focus:ring-[#007A3D]"
              required
            />
          </div>
          <button 
            type="submit" 
            className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 rounded-lg font-semibold shadow-md transition-all flex items-center justify-center gap-2 transform active:scale-95 text-sm h-[38px] w-full md:w-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            Ajouter
          </button>
        </form>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-[1400px] px-4 md:px-8 pb-10 flex-grow flex flex-col">
        
        {tasks.length === 0 ? (
          /* Empty State */
          <div className="flex-grow flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200 shadow-sm p-10">
            <div className="w-32 h-32 bg-[#E6F4ED] rounded-full flex items-center justify-center mb-6">
              <svg className="w-16 h-16 text-[#007A3D]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-700 mb-2">Aucune tâche ajoutée</h2>
            <p className="text-slate-500 text-center max-w-md">Importez un fichier CSV avec les colonnes <b>Secteur</b>, <b>date debut</b>, et <b>date fin</b> (format jj/mm/aaaa) pour générer votre diagramme de Gantt automatiquement.</p>
          </div>
        ) : (
          /* Chart Layout */
          <div className="flex flex-col lg:flex-row gap-6 relative">
            
            {/* Chart Container */}
            <div ref={chartRef} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-grow flex flex-col relative z-0">
              
              {/* Header inside Chart container */}
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#007A3D]"></span>
                  Planning des Tâches
                </h3>
                <span className="text-xs font-semibold text-slate-500 bg-white px-2 py-1 rounded shadow-sm border border-slate-200">
                  {tasks.length} tâche{tasks.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Flex wrapper for labels + chart area */}
              <div className="flex w-full relative">
                
                {/* Left Labels Column - Auto fit to longest name, fixed on mobile */}
                <div className="w-auto flex-shrink-0 bg-white border-r border-slate-200 z-10 sticky left-0 shadow-[4px_0_12px_rgba(0,0,0,0.02)]">
                  {/* Empty top cell for header alignment */}
                  <div className="h-10 border-b border-slate-200 bg-slate-50"></div>
                  
                  {tasks.map((t, idx) => (
                    <div 
                      key={t.id} 
                      className={`px-4 flex items-center whitespace-nowrap border-b border-slate-100 ${chartData.rowHeightClass} ${idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FDF9]'}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-[#007A3D] mr-3 opacity-80"></span>
                      <span className="font-bold text-slate-700 text-sm">{t.name}</span>
                    </div>
                  ))}
                </div>

                {/* Right Chart Area - Scrollable horizontally on small screens */}
                <div className="flex-grow overflow-x-auto">
                  <div className="min-w-[700px] relative">
                    
                    {/* Time Header */}
                    <div className="h-10 border-b border-slate-200 bg-slate-50 relative">
                      {chartData.ticks.map((tick, i) => {
                        const pct = ((tick.getTime() - chartData.minStart) / chartData.totalMs) * 100;
                        return (
                          <div key={i} className="absolute top-0 bottom-0 border-l border-dashed border-slate-300 flex flex-col justify-end pb-1" style={{ left: `${pct}%` }}>
                            <span className="text-[10px] font-bold text-slate-500 -ml-1 transform -translate-x-1/2 whitespace-nowrap bg-slate-50 px-1 rounded">
                              {formatTick(tick)}
                            </span>
                          </div>
                        );
                      })}
                      {/* Today Label Header */}
                      {todayPct !== null && (
                        <div className="absolute top-0 bottom-0 flex flex-col justify-end pb-1 z-20" style={{ left: `${todayPct}%` }}>
                           <span className="text-[9px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded -ml-1 transform -translate-x-1/2 whitespace-nowrap">
                             Aujourd'hui
                           </span>
                        </div>
                      )}
                    </div>

                    {/* Chart Rows Background & Grid & Today Line */}
                    <div className="relative">
                      {/* Grid Lines (Vertical) */}
                      {chartData.ticks.map((tick, i) => {
                        const pct = ((tick.getTime() - chartData.minStart) / chartData.totalMs) * 100;
                        return (
                          <div key={`grid-${i}`} className="absolute top-0 bottom-0 border-l border-dashed border-slate-200" style={{ left: `${pct}%`, zIndex: 0 }}></div>
                        );
                      })}

                      {/* Today Line */}
                      {todayPct !== null && (
                        <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-red-400 z-10" style={{ left: `${todayPct}%` }}></div>
                      )}

                      {/* Task Rows */}
                      {tasks.map((t, idx) => {
                        const pos = getPositionStyles(t.start, t.end, chartData.minStart, chartData.totalMs);
                        const days = durationDays(t.start, t.end);
                        const isSelected = selectedTask?.id === t.id;
                        
                        // Parse float to determine logic for narrow bars
                        const widthVal = parseFloat(pos.width);
                        const isNarrow = widthVal < 10; 

                        return (
                          <div 
                            key={`row-${t.id}`} 
                            className={`relative border-b border-slate-100 flex items-center px-2 group ${chartData.rowHeightClass} ${idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FDF9]'} hover:bg-slate-100/50 transition-colors`}
                          >
                            
                            {/* Track Background */}
                            <div className="absolute inset-y-2 left-2 right-2 bg-[#E6F4ED] rounded border border-[#cceadc] opacity-50 z-0"></div>

                            {/* Task Bar Wrapper to handle positioning relatively to the row */}
                            <div className="absolute inset-y-0 left-0 right-0 z-10">
                              <div 
                                className={`absolute top-1/2 transform -translate-y-1/2 ${chartData.barHeightClass} bg-[#007A3D] rounded-md shadow-sm border ${isSelected ? 'border-2 border-[#003A1D] shadow-md ring-2 ring-[#007A3D]/30' : 'border-[#005C2E]'} cursor-pointer transition-all duration-200 group-hover:brightness-110`}
                                style={pos}
                                onClick={() => setSelectedTask(isSelected ? null : t)}
                                onMouseEnter={() => setHoveredTask(t)}
                                onMouseLeave={() => setHoveredTask(null)}
                              >
                                {/* Interactive hit area expansion */}
                                <div className="absolute inset-x-0 -inset-y-2"></div>
                                
                                {/* Label rendering strategy based on bar width */}
                                {!isNarrow ? (
                                  // Centered below bar
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 whitespace-nowrap opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity pointer-events-none">
                                    <span className="text-[10px] font-bold text-slate-600 bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-slate-100">
                                      {formatDMY(t.start)} → {formatDMY(t.end)} ({days}j)
                                    </span>
                                  </div>
                                ) : (
                                  // Shifted to the right of the bar
                                  <div className="absolute top-1/2 -right-2 transform translate-x-full -translate-y-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity pointer-events-none">
                                    <span className="text-[10px] font-bold text-slate-600 bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-slate-100">
                                      {formatDMY(t.start)} → {formatDMY(t.end)} ({days}j)
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal / Side Panel for Selected Task Details */}
            {selectedTask && (
              <div className="lg:w-80 flex-shrink-0 bg-white rounded-xl border border-slate-200 shadow-lg p-6 relative lg:sticky lg:top-6 lg:h-max animate-in slide-in-from-right-4 duration-200">
                <button 
                  onClick={() => setSelectedTask(null)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full p-1 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div className="w-12 h-12 rounded-full bg-[#E6F4ED] flex items-center justify-center mb-4 border border-[#007A3D]/20">
                  <svg className="w-6 h-6 text-[#007A3D]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                
                <h3 className="text-xl font-bold text-slate-800 mb-6 pr-6 leading-tight">{selectedTask.name}</h3>
                
                <div className="space-y-4">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase">Début</span>
                    <span className="text-sm font-semibold text-slate-800">{formatDMY(selectedTask.start)}</span>
                  </div>
                  
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase">Fin</span>
                    <span className="text-sm font-semibold text-slate-800">{formatDMY(selectedTask.end)}</span>
                  </div>
                  
                  <div className="bg-[#E6F4ED] p-3 rounded-lg border border-[#cceadc] flex items-center justify-between">
                    <span className="text-xs font-bold text-[#005C2E] uppercase">Durée</span>
                    <span className="text-sm font-extrabold text-[#007A3D]">{durationDays(selectedTask.start, selectedTask.end)} jours</span>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-100">
                  <button 
                    onClick={() => {
                      setTasks(tasks.filter(t => t.id !== selectedTask.id));
                      setSelectedTask(null);
                    }}
                    className="w-full text-red-600 font-semibold text-sm hover:bg-red-50 py-2 rounded-lg transition-colors border border-transparent hover:border-red-100"
                  >
                    Supprimer cette tâche
                  </button>
                </div>
              </div>
            )}

            {/* Tooltip on hover (only if not selected to avoid clutter) */}
            {hoveredTask && hoveredTask.id !== selectedTask?.id && (
              <div 
                className="fixed z-50 pointer-events-none bg-slate-800 text-white p-3 rounded-lg shadow-xl border border-slate-700 max-w-xs animate-in fade-in duration-150"
                style={{ 
                  left: '50%', 
                  top: '20px', 
                  transform: 'translateX(-50%)' 
                }}
              >
                <p className="font-bold text-sm mb-1">{hoveredTask.name}</p>
                <div className="text-xs text-slate-300 flex items-center gap-2">
                  <span>{formatDMY(hoveredTask.start)}</span>
                  <span className="text-slate-500">→</span>
                  <span>{formatDMY(hoveredTask.end)}</span>
                </div>
                <div className="mt-2 text-xs font-semibold text-[#4ade80]">
                  {durationDays(hoveredTask.start, hoveredTask.end)} jours
                </div>
              </div>
            )}

          </div>
        )}
      </div>

    </div>
  );
}
