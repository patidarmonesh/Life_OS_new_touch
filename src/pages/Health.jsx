import SleepPanel from '../components/areas/SleepPanel'
import { useMemo, useState, useRef } from 'react'
import { useAppActions, useAppState } from '../context/appHooks'
import { format, subDays } from 'date-fns'
import { v4 as uuid } from 'uuid'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts'
import { Plus, Upload, Dumbbell, Utensils, Activity, Trash2, X, Zap } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { formatDateKey, getTodayDateKey, toDateKey } from '../utils/dateTime'
import { useToast } from '../context/toastContextCore'
import { playSuccessSound, playSubtleClick, playWarningBeep } from '../hooks/useAudio'
import { hapticSuccess, hapticLight } from '../hooks/useHaptic'

/* ─── constants ────────────────────────────────────────────── */
const METRIC_CONFIG = {
  weight:     { label: 'Weight',      unit: 'kg', color: '#3B82F6', icon: '⚖️' },
  bodyFat:    { label: 'Body Fat',    unit: '%',  color: '#F97316', icon: '📊' },
  muscleMass: { label: 'Muscle Mass', unit: 'kg', color: '#10B981', icon: '💪' },
  waist:      { label: 'Waist',       unit: 'cm', color: '#EC4899', icon: '📏' },
  chest:      { label: 'Chest',       unit: 'cm', color: '#8B5CF6', icon: '📏' },
  bicep:      { label: 'Bicep',       unit: 'cm', color: '#F59E0B', icon: '💪' },
}
const GYM_DAY_TYPES = ['Push','Pull','Legs','Upper','Lower','Full Body','Cardio','Rest Day','Custom']
const FEELING_OPTIONS = ['😴 Tired','😐 Okay','😊 Good','💪 Strong','🔥 Crushed it']
const MEAL_TYPES = ['Breakfast','Lunch','Dinner','Snack','Pre-Workout','Post-Workout']
const MACRO_COLORS = { calories:'#F97316', protein:'#10B981', carbs:'#3B82F6', fat:'#F59E0B' }
const EMPTY_ARRAY = []

const emptySet = () => ({ reps: '', weight: '' })
const emptyExercise = () => ({ name: '', sets: [emptySet()] })
const emptyGymForm = (date) => ({
  date, dayType: 'Push', customName: '', feeling: '😊 Good',
  exercises: [emptyExercise()], notes: '',
})
const emptyMeal = () => ({ type: 'Lunch', food: '', calories: '', protein: '' })
const emptyNutritionForm = (date) => ({
  date, meals: [emptyMeal()], carbs: '', fat: '', notes: '',
})

/* ─── helpers ──────────────────────────────────────────────── */
function calcVolume(exercises) {
  if (!Array.isArray(exercises)) return 0
  return Math.round(exercises.reduce((sum, ex) =>
    sum + (ex.sets || []).reduce((s, set) =>
      s + (Number(set.reps) || 0) * (Number(set.weight) || 0), 0), 0))
}

function formatExSets(exercise) {
  if (!exercise?.sets?.length) return ''
  const groups = []
  let i = 0
  while (i < exercise.sets.length) {
    const s = exercise.sets[i]
    let count = 1
    while (i + count < exercise.sets.length &&
      exercise.sets[i + count].reps === s.reps &&
      exercise.sets[i + count].weight === s.weight) count++
    groups.push(`${count}×${s.reps}${s.weight ? ` @${s.weight}kg` : ''}`)
    i += count
  }
  return groups.join(', ')
}

/* ═══════════════════════════════════════════════════════════ */
export default function Health() {
  const state = useAppState()
  const { setModule } = useAppActions()
  const { showToast } = useToast()
  const timezone = state.settings?.profile?.timezone
  const today = getTodayDateKey(timezone)

  const [energyLevel, setEnergyLevel] = useState(3)
  const [energyNotes, setEnergyNotes] = useState('')

  const energyLogs = useMemo(() => state.health?.energyLogs || [], [state.health?.energyLogs])

  function handleLogEnergy() {
    const newLog = {
      id: uuid(),
      date: today,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      level: Number(energyLevel),
      notes: energyNotes.trim(),
      createdAt: new Date().toISOString()
    }
    const updatedLogs = [newLog, ...energyLogs]
    setModule('health', {
      ...state.health,
      energyLogs: updatedLogs
    })
    setEnergyNotes('')
    showToast('Logged energy level! ⚡', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  const chartData = useMemo(() => {
    const hourlyData = {}
    for (let h = 0; h < 24; h++) {
      hourlyData[h] = { count: 0, sum: 0 }
    }

    energyLogs.forEach(log => {
      const timeStr = log.time || ''
      const hourPart = parseInt(timeStr.split(':')[0])
      if (!isNaN(hourPart) && hourPart >= 0 && hourPart < 24) {
        hourlyData[hourPart].sum += Number(log.level)
        hourlyData[hourPart].count += 1
      }
    })

    const result = []
    for (let h = 0; h < 24; h++) {
      if (hourlyData[h].count > 0) {
        result.push({
          hour: `${String(h).padStart(2, '0')}:00`,
          avgLevel: parseFloat((hourlyData[h].sum / hourlyData[h].count).toFixed(1)),
        })
      }
    }
    return result.sort((a, b) => a.hour.localeCompare(b.hour))
  }, [energyLogs])

  // goals from settings
  const prefs = state.settings?.preferences || {}
  const stepGoal = prefs.dailyStepGoal || 10000
  const proteinGoal = prefs.proteinGoal || 160
  const calorieGoal = prefs.calorieGoal || 2200
  const weightGoal = prefs.weightGoal || 72
  const waterGoal = prefs.waterGoal || 3000

  const [activeTab, setActiveTab] = useState('today')
  const [showLogModal, setShowLogModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showGymModal, setShowGymModal] = useState(false)
  const [showNutritionModal, setShowNutritionModal] = useState(false)
  const [importStatus, setImportStatus] = useState(null)

  const [logForm, setLogForm] = useState({
    date: today, weight:'', bodyFat:'', muscleMass:'',
    waist:'', chest:'', bicep:'', steps:'', notes:''
  })
  const [todayForm, setTodayForm] = useState({ steps:'', weight:'', protein:'', calories:'', notes:'' })
  const [gymForm, setGymForm] = useState(() => emptyGymForm(today))
  const [nutritionForm, setNutritionForm] = useState(() => emptyNutritionForm(today))

  const cronometerRef = useRef(null)
  const hevyRef = useRef(null)
  const appleRef = useRef(null)

  const bodyLogs       = state.health?.bodyLogs       || EMPTY_ARRAY
  const nutrition      = state.health?.nutrition       || EMPTY_ARRAY
  const hevyWorkouts   = state.health?.hevyWorkouts   || EMPTY_ARRAY
  const manualWorkouts = state.health?.manualWorkouts  || EMPTY_ARRAY
  const waterLogs      = state.health?.waterLogs      || EMPTY_ARRAY

  /* ─── today lookups ─────────────────────────────────────── */
  const todayBodyLog   = useMemo(() => bodyLogs.find(l => l.date === today), [bodyLogs, today])
  const todayNutrition = useMemo(() => nutrition.find(n => n.date === today), [nutrition, today])
  const todayGymLog    = useMemo(() => manualWorkouts.find(w => w.date === today), [manualWorkouts, today])
  const todayWaterLogs = useMemo(() => waterLogs.filter(w => w.date === today), [waterLogs, today])
  const todayWaterTotal = useMemo(() => todayWaterLogs.reduce((acc, log) => acc + (log.amountMl || 0), 0), [todayWaterLogs])

  /* ─── chart data ────────────────────────────────────────── */
  const metricHistory = useMemo(() => {
    const sorted = [...bodyLogs].sort((a, b) => a.date.localeCompare(b.date))
    return Object.fromEntries(
      Object.keys(METRIC_CONFIG).map(m => [m,
        sorted.filter(l => l[m] != null).slice(-30)
          .map(l => ({ date: format(new Date(l.date+'T00:00:00'),'MMM d'), value: l[m] }))
      ])
    )
  }, [bodyLogs])

  const latestLog = useMemo(
    () => bodyLogs.length ? [...bodyLogs].sort((a,b)=>b.date.localeCompare(a.date))[0] : null,
    [bodyLogs]
  )

  function logWater(amountMl) {
    const newLog = {
      id: 'water_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      amountMl: parseInt(amountMl),
      date: today,
      timestamp: new Date().toISOString(),
    }
    const updatedLogs = [...waterLogs, newLog]
    const prevTotal = todayWaterTotal
    const nextTotal = prevTotal + amountMl
    if (nextTotal >= waterGoal && prevTotal < waterGoal) {
      showToast('🎉 Hydration Goal Achieved! Fantastic job!', 'success')
      playSuccessSound()
      hapticSuccess()
    } else {
      playSuccessSound()
      hapticSuccess()
    }
    setModule('health', {
      ...state.health,
      waterLogs: updatedLogs
    })
  }

  function undoLastWaterLog() {
    if (todayWaterLogs.length === 0) return
    const lastLog = todayWaterLogs[todayWaterLogs.length - 1]
    const updatedLogs = waterLogs.filter(l => l.id !== lastLog.id)
    setModule('health', {
      ...state.health,
      waterLogs: updatedLogs
    })
    showToast('Last water log removed', 'warning')
    playWarningBeep()
    hapticLight()
  }

  const last14Nutrition = useMemo(() => Array.from({length:14},(_,i)=>{
    const d = toDateKey(subDays(new Date(),13-i), timezone)
    const e = nutrition.find(n=>n.date===d)
    return { day: formatDateKey(d,timezone,{month:'short',day:'numeric'}),
      calories:e?.calories||0, protein:e?.protein||0, carbs:e?.carbs||0, fat:e?.fat||0 }
  }),[nutrition,timezone])

  const avgNutrition = useMemo(() => nutrition.length ? {
    calories: Math.round(nutrition.reduce((a,n)=>a+(n.calories||0),0)/nutrition.length),
    protein:  Math.round(nutrition.reduce((a,n)=>a+(n.protein||0),0)/nutrition.length),
    carbs:    Math.round(nutrition.reduce((a,n)=>a+(n.carbs||0),0)/nutrition.length),
    fat:      Math.round(nutrition.reduce((a,n)=>a+(n.fat||0),0)/nutrition.length),
  } : null, [nutrition])

  const hevyVolumeData = useMemo(() => Array.from({length:14},(_,i)=>{
    const d = format(subDays(new Date(),13-i),'yyyy-MM-dd')
    const w = hevyWorkouts.find(x=>x.date===d)
    const vol = w?.exercises?.reduce((a,ex)=>a+(ex.sets||[]).reduce((s,set)=>s+set.reps*set.weight,0),0)||0
    return { day: format(new Date(d+'T00:00:00'),'MMM d'), volume: Math.round(vol) }
  }),[hevyWorkouts])

  const last14Steps = useMemo(() => Array.from({length:14},(_,i)=>{
    const d = format(subDays(new Date(),13-i),'yyyy-MM-dd')
    const l = bodyLogs.find(x=>x.date===d)
    return { day: format(new Date(d+'T00:00:00'),'MMM d'), steps: l?.steps||0 }
  }),[bodyLogs])

  /* ─── gym form helpers ──────────────────────────────────── */
  function addExercise() {
    setGymForm(f => ({ ...f, exercises: [...f.exercises, emptyExercise()] }))
  }
  function removeExercise(idx) {
    setGymForm(f => ({ ...f, exercises: f.exercises.filter((_,i)=>i!==idx) }))
  }
  function updateExName(idx, name) {
    setGymForm(f => {
      const ex = [...f.exercises]; ex[idx] = { ...ex[idx], name }; return { ...f, exercises: ex }
    })
  }
  function addSet(exIdx) {
    setGymForm(f => {
      const ex = [...f.exercises]
      ex[exIdx] = { ...ex[exIdx], sets: [...ex[exIdx].sets, emptySet()] }
      return { ...f, exercises: ex }
    })
  }
  function removeSet(exIdx, setIdx) {
    setGymForm(f => {
      const ex = [...f.exercises]
      ex[exIdx] = { ...ex[exIdx], sets: ex[exIdx].sets.filter((_,i)=>i!==setIdx) }
      return { ...f, exercises: ex }
    })
  }
  function updateSet(exIdx, setIdx, field, value) {
    setGymForm(f => {
      const ex = [...f.exercises]
      const sets = [...ex[exIdx].sets]
      sets[setIdx] = { ...sets[setIdx], [field]: value }
      ex[exIdx] = { ...ex[exIdx], sets }
      return { ...f, exercises: ex }
    })
  }
  const gymVolume = useMemo(() => calcVolume(gymForm.exercises), [gymForm.exercises])

  /* ─── nutrition form helpers ────────────────────────────── */
  function addMeal() {
    setNutritionForm(f => ({ ...f, meals: [...f.meals, emptyMeal()] }))
  }
  function removeMeal(idx) {
    setNutritionForm(f => ({ ...f, meals: f.meals.filter((_,i)=>i!==idx) }))
  }
  function updateMeal(idx, field, value) {
    setNutritionForm(f => {
      const meals = [...f.meals]; meals[idx] = { ...meals[idx], [field]: value }
      return { ...f, meals }
    })
  }
  const mealTotals = useMemo(() => {
    const m = nutritionForm.meals || []
    return {
      calories: m.reduce((a,x) => a + (Number(x.calories)||0), 0),
      protein:  m.reduce((a,x) => a + (Number(x.protein)||0), 0),
    }
  }, [nutritionForm.meals])

  /* ─── delete functions ──────────────────────────────────── */
  function deleteBodyLog(id) {
    if (!window.confirm('Delete this body log?')) return
    setModule('health', { ...state.health, bodyLogs: bodyLogs.filter(l=>l.id!==id) })
  }
  function deleteManualWorkout(id) {
    if (!window.confirm('Delete this workout?')) return
    setModule('health', { ...state.health, manualWorkouts: manualWorkouts.filter(w=>w.id!==id) })
  }
  function deleteNutritionEntry(id) {
    if (!window.confirm('Delete this nutrition entry?')) return
    setModule('health', { ...state.health, nutrition: nutrition.filter(n=>n.id!==id) })
  }

  /* ─── save: today quick log ─────────────────────────────── */
  function saveTodayLog() {
    const { steps, weight, protein, calories, notes } = todayForm
    if (!steps && !weight && !protein && !calories) return alert('Kuch toh daal!')

    let nextBody = [...bodyLogs], nextNutr = [...nutrition]

    if (steps || weight) {
      const existing = bodyLogs.find(l => l.date === today)
      const entry = {
        ...(existing || { id: uuid(), date: today, createdAt: new Date().toISOString() }),
        ...(weight ? { weight: parseFloat(weight) } : {}),
        ...(steps  ? { steps: parseInt(steps) }     : {}),
        source: 'manual', updatedAt: new Date().toISOString(),
      }
      nextBody = [entry, ...nextBody.filter(l => l.date !== today)]
    }
    if (protein || calories) {
      const existing = nutrition.find(n => n.date === today)
      const entry = {
        ...(existing || { id: uuid(), date: today, source: 'manual' }),
        ...(protein  ? { protein: parseFloat(protein) }   : {}),
        ...(calories ? { calories: parseFloat(calories) } : {}),
        notes, updatedAt: new Date().toISOString(),
      }
      nextNutr = [entry, ...nextNutr.filter(n => n.date !== today)]
    }
    setModule('health', { ...state.health, bodyLogs: nextBody, nutrition: nextNutr })
    setTodayForm({ steps:'', weight:'', protein:'', calories:'', notes:'' })
  }

  /* ─── save: body metrics ────────────────────────────────── */
  function saveBodyLog() {
    const hasData = [...Object.keys(METRIC_CONFIG),'steps'].some(k => logForm[k] !== '')
    if (!hasData) return alert('Enter at least one measurement')
    const entry = {
      id: uuid(), date: logForm.date, notes: logForm.notes,
      ...Object.fromEntries(
        [...Object.keys(METRIC_CONFIG),'steps'].filter(k=>logForm[k]!=='')
          .map(k=>[k, k==='steps'? parseInt(logForm[k]) : parseFloat(logForm[k])])
      ),
      source:'manual', createdAt: new Date().toISOString()
    }
    setModule('health', { ...state.health, bodyLogs: [entry, ...bodyLogs.filter(l=>l.date!==logForm.date)] })
    setShowLogModal(false)
    setLogForm({ date:today, weight:'', bodyFat:'', muscleMass:'', waist:'', chest:'', bicep:'', steps:'', notes:'' })
  }

  /* ─── save: gym log ─────────────────────────────────────── */
  function saveGymLog() {
    if (!gymForm.date) return alert('Date daal')
    const title = gymForm.dayType === 'Custom' ? (gymForm.customName || 'Workout') : gymForm.dayType
    const exercises = gymForm.exercises
      .filter(ex => ex.name.trim())
      .map(ex => ({
        name: ex.name.trim(),
        sets: ex.sets.filter(s => s.reps).map(s => ({
          reps: parseInt(s.reps) || 0,
          weight: parseFloat(s.weight) || 0,
        }))
      }))
    const entry = {
      id: uuid(), date: gymForm.date, title, dayType: gymForm.dayType,
      feeling: gymForm.feeling, exercises,
      totalVolume: calcVolume(exercises),
      notes: gymForm.notes, source: 'manual',
      createdAt: new Date().toISOString(),
    }
    setModule('health', { ...state.health, manualWorkouts: [entry, ...manualWorkouts.filter(w=>w.date!==gymForm.date)] })
    setShowGymModal(false)
    setGymForm(emptyGymForm(today))
  }

  /* ─── save: nutrition ───────────────────────────────────── */
  function saveNutritionLog() {
    if (!nutritionForm.date) return alert('Date daal')
    const meals = nutritionForm.meals
      .filter(m => m.food.trim() || m.calories || m.protein)
      .map(m => ({ type: m.type, food: m.food.trim(), calories: Number(m.calories)||0, protein: Number(m.protein)||0 }))
    const totalCal = meals.length ? meals.reduce((a,m)=>a+m.calories,0) : 0
    const totalPro = meals.length ? meals.reduce((a,m)=>a+m.protein,0) : 0
    if (!totalCal && !totalPro) return alert('Kuch toh daal — calories ya protein')
    const entry = {
      id: uuid(), date: nutritionForm.date, source: 'manual', meals,
      calories: totalCal, protein: totalPro,
      carbs: Number(nutritionForm.carbs)||0,
      fat: Number(nutritionForm.fat)||0,
      notes: nutritionForm.notes,
      createdAt: new Date().toISOString(),
    }
    setModule('health', { ...state.health, nutrition: [entry, ...nutrition.filter(n=>n.date!==nutritionForm.date)] })
    setShowNutritionModal(false)
    setNutritionForm(emptyNutritionForm(today))
  }

  /* ─── open gym modal with prefill ───────────────────────── */
  function openGymModal(existing) {
    if (existing) {
      setGymForm({
        date: existing.date, dayType: existing.dayType || 'Push',
        customName: existing.dayType === 'Custom' ? existing.title : '',
        feeling: existing.feeling || '😊 Good',
        exercises: existing.exercises?.length
          ? existing.exercises.map(ex => ({
              name: ex.name, sets: ex.sets?.length ? ex.sets.map(s=>({reps:String(s.reps),weight:String(s.weight)})) : [emptySet()]
            }))
          : [emptyExercise()],
        notes: existing.notes || '',
      })
    } else {
      setGymForm(emptyGymForm(today))
    }
    setShowGymModal(true)
  }

  function openNutritionModal(existing) {
    if (existing) {
      setNutritionForm({
        date: existing.date,
        meals: existing.meals?.length
          ? existing.meals.map(m=>({type:m.type||'Lunch', food:m.food||'', calories:String(m.calories||''), protein:String(m.protein||'')}))
          : [{ type:'Lunch', food:'', calories:String(existing.calories||''), protein:String(existing.protein||'') }],
        carbs: String(existing.carbs||''), fat: String(existing.fat||''),
        notes: existing.notes || '',
      })
    } else {
      setNutritionForm(emptyNutritionForm(today))
    }
    setShowNutritionModal(true)
  }

  /* ─── imports (unchanged) ───────────────────────────────── */
  function handleCronometerImport(e) {
    const file = e.target.files[0]; if (!file) return
    setImportStatus('reading')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const lines = ev.target.result.split('\n').filter(Boolean)
        const headers = lines[0].split(',').map(h=>h.trim().replace(/"/g,'').toLowerCase())
        const parsed = []
        for (let i=1;i<lines.length;i++){
          const cols=lines[i].split(',').map(c=>c.trim().replace(/"/g,''))
          const row={}; headers.forEach((h,idx)=>{row[h]=cols[idx]})
          const dateRaw=row['day']||row['date']||''; if(!dateRaw) continue
          let dateStr=dateRaw
          if(dateRaw.includes('/')){const[m,d,y]=dateRaw.split('/');dateStr=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`}
          const entry={id:uuid(),date:dateStr,source:'cronometer',
            calories:parseFloat(row['energy (kcal)']||row['calories']||0)||0,
            protein:parseFloat(row['protein (g)']||row['protein']||0)||0,
            carbs:parseFloat(row['carbohydrates (g)']||row['carbs']||0)||0,
            fat:parseFloat(row['fat (g)']||row['fat']||0)||0,
            fiber:parseFloat(row['fiber (g)']||row['fiber']||0)||0}
          if(entry.calories>0||entry.protein>0) parsed.push(entry)
        }
        const existing=(state.health?.nutrition||[]).filter(n=>n.source!=='cronometer')
        setModule('health',{...state.health,nutrition:[...existing,...parsed]})
        setImportStatus(`success:${parsed.length}`)
      } catch{ setImportStatus('error') }
    }; reader.readAsText(file)
  }

  function handleHevyImport(e) {
    const file = e.target.files[0]; if (!file) return
    setImportStatus('reading')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const lines=ev.target.result.split('\n').filter(Boolean)
        const headers=lines[0].split(',').map(h=>h.trim().replace(/"/g,'').toLowerCase())
        const wMap={}
        for(let i=1;i<lines.length;i++){
          const cols=lines[i].split(',').map(c=>c.trim().replace(/"/g,''))
          const row={}; headers.forEach((h,idx)=>{row[h]=cols[idx]})
          const dateRaw=row['start_time']||row['date']||''
          const dateStr=dateRaw?dateRaw.split(' ')[0].split('T')[0]:''
          if(!dateStr) continue
          const wTitle=row['workout_name']||row['title']||'Workout'
          const key=dateStr+'_'+wTitle
          if(!wMap[key]) wMap[key]={id:uuid(),date:dateStr,title:wTitle,source:'hevy',exercises:[],createdAt:new Date().toISOString()}
          const exName=row['exercise_name']||row['exercise_title']||''
          if(exName){
            let ex=wMap[key].exercises.find(e=>e.name===exName)
            if(!ex){ex={name:exName,sets:[]};wMap[key].exercises.push(ex)}
            ex.sets.push({reps:parseInt(row['reps']||0),weight:parseFloat(row['weight_kg']||row['weight']||0)})
          }
        }
        const parsed=Object.values(wMap)
        const existing=(state.health?.hevyWorkouts||[]).filter(w=>w.source!=='hevy')
        setModule('health',{...state.health,hevyWorkouts:[...existing,...parsed]})
        setImportStatus(`success:${parsed.length}`)
      } catch{ setImportStatus('error') }
    }; reader.readAsText(file)
  }

  function handleAppleImport(e) {
    const file = e.target.files[0]; if (!file) return
    setImportStatus('reading')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text=ev.target.result
        const stepM=[...text.matchAll(/type="HKQuantityTypeIdentifierStepCount"[^>]*startDate="([^"]+)"[^>]*value="([^"]+)"/g)]
        const weightM=[...text.matchAll(/type="HKQuantityTypeIdentifierBodyMass"[^>]*startDate="([^"]+)"[^>]*value="([^"]+)"/g)]
        const hrM=[...text.matchAll(/type="HKQuantityTypeIdentifierHeartRate"[^>]*startDate="([^"]+)"[^>]*value="([^"]+)"/g)]
        const stepsByDay={};stepM.forEach(([,dr,v])=>{const d=dr.split(' ')[0];stepsByDay[d]=(stepsByDay[d]||0)+parseInt(v)})
        const weightByDay={};weightM.forEach(([,dr,v])=>{weightByDay[dr.split(' ')[0]]=parseFloat(v)})
        const hrByDay={};hrM.forEach(([,dr,v])=>{const d=dr.split(' ')[0];if(!hrByDay[d])hrByDay[d]=[];hrByDay[d].push(parseFloat(v))})
        const allDates=new Set([...Object.keys(weightByDay),...Object.keys(stepsByDay)])
        const newLogs=[];allDates.forEach(date=>{newLogs.push({id:uuid(),date,source:'apple_health',
          weight:weightByDay[date]||null,steps:stepsByDay[date]||null,
          restingHR:hrByDay[date]?Math.round(hrByDay[date].reduce((a,b)=>a+b)/hrByDay[date].length):null})})
        const existing=(state.health?.bodyLogs||[]).filter(l=>l.source!=='apple_health')
        setModule('health',{...state.health,bodyLogs:[...existing,...newLogs]})
        setImportStatus(`success:${newLogs.length}`)
      } catch{ setImportStatus('error') }
    }; reader.readAsText(file)
  }

  /* ─── styles ────────────────────────────────────────────── */
  const inputStyle = {
    width:'100%', padding:'10px 12px', borderRadius:'10px',
    background:'var(--bg-secondary)', border:'1px solid var(--border)',
    color:'var(--text-primary)', fontSize:'14px', outline:'none',
    fontFamily:'DM Sans, sans-serif', boxSizing:'border-box',
  }
  const smallInput = { ...inputStyle, width:'70px', padding:'8px', textAlign:'center', fontSize:'13px' }
  const labelStyle = {
    fontSize:'11px', color:'var(--text-muted)', fontWeight:'700',
    marginBottom:'4px', display:'block', textTransform:'uppercase', letterSpacing:'0.05em',
  }
  const tabStyle = (active) => ({
    padding:'8px 16px', borderRadius:'8px 8px 0 0', border:'none', cursor:'pointer',
    background: active ? 'var(--bg-card)' : 'transparent',
    color: active ? '#10B981' : 'var(--text-muted)',
    fontWeight: active ? '700' : '400', fontSize:'13px', fontFamily:'DM Sans, sans-serif',
    borderBottom: active ? '2px solid #10B981' : '2px solid transparent', whiteSpace:'nowrap',
  })
  const tooltipStyle = { background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'8px', fontSize:'12px' }
  const deleteBtn = {
    background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)',
    padding:'4px', borderRadius:'6px', display:'flex', alignItems:'center',
  }

  const todaySteps   = todayBodyLog?.steps    || null
  const todayWeight  = todayBodyLog?.weight   || null
  const todayProtein = todayNutrition?.protein || null
  const todayCals    = todayNutrition?.calories || null

  return (
    <div className="legacy-area" style={{ maxWidth:'800px', margin:'0 auto' }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ padding:'20px 24px 0', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'10px' }}>
        <h1 style={{ fontFamily:'Syne, sans-serif', fontWeight:'800', fontSize:'1.4rem' }}>🏥 Health</h1>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          <Button variant="secondary" onClick={()=>{setShowImportModal(true);setImportStatus(null)}}><Upload size={15}/> Import</Button>
          <Button variant="secondary" onClick={()=>openGymModal()}><Dumbbell size={15}/> Gym Log</Button>
          <Button variant="secondary" onClick={()=>openNutritionModal()}><Utensils size={15}/> Food Log</Button>
          <Button onClick={()=>setShowLogModal(true)}><Plus size={16}/> Body Metrics</Button>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:'2px', padding:'16px 24px 0', borderBottom:'1px solid var(--border)', overflowX:'auto' }}>
        {['today','body','nutrition','workouts','energy','overview'].map(tab=>(
          <button key={tab} onClick={()=>setActiveTab(tab)} style={tabStyle(activeTab===tab)}>
            {tab==='today'?'⚡ Today':tab==='body'?'⚖️ Body':tab==='nutrition'?'🥗 Nutrition':tab==='workouts'?'🏋️ Workouts':tab==='energy'?'🔋 Energy Rhythm':'📊 Overview'}
          </button>
        ))}
      </div>

      <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:'16px' }}>

        {/* ══════ TODAY TAB ═════════════════════════════════════ */}
        {activeTab === 'today' && <>
          <Card><h3>Device imports</h3><p>Not connected. Add actual measurements manually or import your workout file. Browser watch pairing is unavailable.</p><Button onClick={() => setShowLogModal(true)}>Add measurements</Button></Card>

          {/* stat cards */}
          <div style={{ display:'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap:'10px' }}>
            <Card style={{ padding:'16px', borderLeft:'3px solid #06B6D4' }}>
              <div style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>👣 Steps Today</div>
              <div style={{ fontSize:'26px', fontWeight:'800', fontFamily:'JetBrains Mono, monospace', color: todaySteps ? '#06B6D4' : 'var(--text-muted)' }}>{todaySteps ? todaySteps.toLocaleString() : '—'}</div>
              {todaySteps && <div style={{ fontSize:'11px', color: todaySteps >= stepGoal ? '#10B981' : '#F59E0B', marginTop:'4px' }}>
                {todaySteps >= stepGoal ? '✅ Goal achieved!' : `${(stepGoal - todaySteps).toLocaleString()} more to go`}
              </div>}
            </Card>
            <Card style={{ padding:'16px', borderLeft:'3px solid #3B82F6' }}>
              <div style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>⚖️ Weight</div>
              <div style={{ fontSize:'26px', fontWeight:'800', fontFamily:'JetBrains Mono, monospace', color: todayWeight ? '#3B82F6' : 'var(--text-muted)' }}>{todayWeight ? `${todayWeight} kg` : '—'}</div>
              {latestLog?.weight && !todayWeight && <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' }}>Last: {latestLog.weight}kg • Goal: {weightGoal}kg</div>}
              {todayWeight && <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' }}>Goal: {weightGoal}kg</div>}
            </Card>
            <Card style={{ padding:'16px', borderLeft:'3px solid #10B981' }}>
              <div style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>🥩 Protein</div>
              <div style={{ fontSize:'26px', fontWeight:'800', fontFamily:'JetBrains Mono, monospace', color: todayProtein ? '#10B981' : 'var(--text-muted)' }}>{todayProtein ? `${todayProtein}g` : '—'}</div>
              {todayProtein && <div style={{ fontSize:'11px', color: todayProtein >= proteinGoal ? '#10B981' : '#F59E0B', marginTop:'4px' }}>
                {todayProtein >= proteinGoal ? '✅ Goal hit!' : `${proteinGoal - todayProtein}g left`}
              </div>}
            </Card>
            <Card style={{ padding:'16px', borderLeft:'3px solid #F97316' }}>
              <div style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>🔥 Calories</div>
              <div style={{ fontSize:'26px', fontWeight:'800', fontFamily:'JetBrains Mono, monospace', color: todayCals ? '#F97316' : 'var(--text-muted)' }}>{todayCals ? `${todayCals} kcal` : '—'}</div>
              {todayCals && <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' }}>Goal: {calorieGoal} kcal</div>}
            </Card>
          </div>

          {/* 💧 Hydration Tracker Card */}
          <Card style={{ padding: '18px', background: 'linear-gradient(135deg, rgba(6,182,212,0.03) 0%, rgba(59,130,246,0.03) 100%)', border: '1px solid rgba(6,182,212,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#06B6D4', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>💧 Hydration Tracker</div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ color: '#3B82F6' }}>{todayWaterTotal} ml</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ {waterGoal} ml ({Math.min(100, Math.round((todayWaterTotal / waterGoal) * 100))}%)</span>
                </h3>
              </div>
              {todayWaterLogs.length > 0 && (
                <button
                  onClick={undoLastWaterLog}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    textDecoration: 'underline',
                  }}
                >
                  Undo last log
                </button>
              )}
            </div>

            {/* Cup indicators grid */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '14px 0' }}>
              {Array.from({ length: Math.max(8, Math.ceil(waterGoal / 250)) }).map((_, idx) => {
                const cupMl = 250;
                const threshold = (idx + 1) * cupMl;
                const isFilled = todayWaterTotal >= threshold;
                const isPartiallyFilled = !isFilled && todayWaterTotal > idx * cupMl;
                const pct = isFilled ? 100 : isPartiallyFilled ? Math.round(((todayWaterTotal % cupMl) / cupMl) * 100) : 0;

                return (
                  <div
                    key={idx}
                    title={`${threshold} ml`}
                    style={{
                      width: '28px',
                      height: '38px',
                      border: '2px solid rgba(59,130,246,0.3)',
                      borderRadius: '4px 4px 8px 8px',
                      position: 'relative',
                      background: 'rgba(255,255,255,0.03)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'flex-end',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: `${pct}%`,
                        background: 'linear-gradient(180deg, #60A5FA 0%, #3B82F6 100%)',
                        transition: 'height 0.3s ease',
                      }}
                    />
                    {isFilled && (
                      <span style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        color: '#fff',
                      }}>✓</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { amount: 250, label: '🥛 +250ml' },
                { amount: 500, label: '🥤 +500ml' },
                { amount: 750, label: '🧴 +750ml' },
              ].map(({ amount, label }) => (
                <Button
                  key={amount}
                  variant="secondary"
                  onClick={() => logWater(amount)}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    fontSize: '12px',
                    borderColor: 'rgba(59,130,246,0.2)',
                    color: '#93C5FD',
                    background: 'rgba(59,130,246,0.05)',
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </Card>

          <SleepPanel />

          {/* today's workout */}
          {todayGymLog ? (
            <Card style={{ padding:'16px', border:'1px solid rgba(16,185,129,0.3)', background:'rgba(16,185,129,0.05)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'11px', color:'#10B981', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'4px' }}>🏋️ Today's Workout</div>
                  <div style={{ fontWeight:'700', fontSize:'16px' }}>{todayGymLog.title}</div>
                  <div style={{ fontSize:'13px', color:'var(--text-muted)', marginTop:'4px' }}>{todayGymLog.feeling}</div>
                  {todayGymLog.totalVolume > 0 && <div style={{ fontSize:'13px', color:'#EC4899', fontWeight:'700', marginTop:'2px' }}>{todayGymLog.totalVolume}kg total volume</div>}
                  {Array.isArray(todayGymLog.exercises) && todayGymLog.exercises.map((ex,i) => (
                    <div key={i} style={{ fontSize:'12px', color:'var(--text-secondary)', marginTop:'4px' }}>
                      💪 <strong>{ex.name}</strong> — {formatExSets(ex)}
                    </div>
                  ))}
                  {todayGymLog.notes && <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'6px', fontStyle:'italic' }}>"{todayGymLog.notes}"</div>}
                </div>
                <div style={{ display:'flex', gap:'6px' }}>
                  <button onClick={()=>openGymModal(todayGymLog)} style={{ ...deleteBtn, color:'var(--text-secondary)' }}>Edit</button>
                  <button onClick={()=>deleteManualWorkout(todayGymLog.id)} style={deleteBtn}><Trash2 size={14}/></button>
                </div>
              </div>
            </Card>
          ) : (
            <Card style={{ padding:'16px', border:'1px dashed var(--border)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:'13px', fontWeight:'600', color:'var(--text-secondary)' }}>🏋️ Gym today?</div>
                  <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'2px' }}>Log your workout</div>
                </div>
                <Button onClick={()=>openGymModal()}><Plus size={14}/> Log Gym</Button>
              </div>
            </Card>
          )}

          {/* today's food */}
          {todayNutrition ? (
            <Card style={{ padding:'16px', border:'1px solid rgba(249,115,22,0.3)', background:'rgba(249,115,22,0.04)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'11px', color:'#F97316', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'4px' }}>🥗 Today's Nutrition</div>
                  <div style={{ display:'flex', gap:'16px', marginTop:'4px' }}>
                    <span style={{ fontSize:'14px', fontWeight:'700', color:'#F97316' }}>{todayNutrition.calories||0} kcal</span>
                    <span style={{ fontSize:'14px', fontWeight:'700', color:'#10B981' }}>{todayNutrition.protein||0}g protein</span>
                    {todayNutrition.carbs > 0 && <span style={{ fontSize:'13px', color:'var(--text-muted)' }}>{todayNutrition.carbs}g carbs</span>}
                    {todayNutrition.fat > 0 && <span style={{ fontSize:'13px', color:'var(--text-muted)' }}>{todayNutrition.fat}g fat</span>}
                  </div>
                  {Array.isArray(todayNutrition.meals) && todayNutrition.meals.map((m,i) => (
                    <div key={i} style={{ fontSize:'12px', color:'var(--text-secondary)', marginTop:'4px' }}>
                      🍽️ <strong>{m.type}</strong>: {m.food}{m.calories ? ` — ${m.calories}kcal` : ''}{m.protein ? `, ${m.protein}g protein` : ''}
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:'6px' }}>
                  <button onClick={()=>openNutritionModal(todayNutrition)} style={{ ...deleteBtn, color:'var(--text-secondary)' }}>Edit</button>
                  <button onClick={()=>deleteNutritionEntry(todayNutrition.id)} style={deleteBtn}><Trash2 size={14}/></button>
                </div>
              </div>
            </Card>
          ) : (
            <Card style={{ padding:'16px', border:'1px dashed var(--border)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:'13px', fontWeight:'600', color:'var(--text-secondary)' }}>🥗 Food today?</div>
                  <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'2px' }}>Log your meals & macros</div>
                </div>
                <Button onClick={()=>openNutritionModal()}><Plus size={14}/> Log Food</Button>
              </div>
            </Card>
          )}

          {/* quick log */}
          <Card>
            <h3 style={{ fontFamily:'Syne, sans-serif', fontWeight:'700', fontSize:'14px', marginBottom:'14px' }}>⚡ Quick Log — Today</h3>
            <div style={{ display:'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap:'10px' }}>
              <div><label style={labelStyle}>👣 Steps</label>
                <input style={inputStyle} type="number" inputMode="numeric" placeholder="e.g. 8500" value={todayForm.steps} onChange={e=>setTodayForm(f=>({...f,steps:e.target.value}))}/></div>
              <div><label style={labelStyle}>⚖️ Weight (kg)</label>
                <input style={inputStyle} type="number" inputMode="decimal" step="0.1" placeholder="e.g. 74.5" value={todayForm.weight} onChange={e=>setTodayForm(f=>({...f,weight:e.target.value}))}/></div>
              <div><label style={labelStyle}>🥩 Protein (g)</label>
                <input style={inputStyle} type="number" inputMode="numeric" placeholder={`e.g. ${proteinGoal}`} value={todayForm.protein} onChange={e=>setTodayForm(f=>({...f,protein:e.target.value}))}/></div>
              <div><label style={labelStyle}>🔥 Calories</label>
                <input style={inputStyle} type="number" inputMode="numeric" placeholder={`e.g. ${calorieGoal}`} value={todayForm.calories} onChange={e=>setTodayForm(f=>({...f,calories:e.target.value}))}/></div>
            </div>
            <div style={{ marginTop:'10px' }}><label style={labelStyle}>Notes</label>
              <input style={inputStyle} placeholder="kuch notes..." value={todayForm.notes} onChange={e=>setTodayForm(f=>({...f,notes:e.target.value}))}/></div>
            <Button onClick={saveTodayLog} style={{ marginTop:'12px', width:'100%' }}>Save Today's Log</Button>
          </Card>

          {/* steps chart */}
          {last14Steps.some(d=>d.steps>0) && (
            <Card>
              <h3 style={{ fontFamily:'Syne, sans-serif', fontWeight:'700', fontSize:'14px', marginBottom:'14px' }}>👣 Steps — Last 14 Days</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={last14Steps} margin={{top:0,right:0,bottom:0,left:-10}}>
                  <XAxis dataKey="day" tick={{fontSize:10,fill:'var(--text-muted)'}} axisLine={false} tickLine={false} interval={2}/>
                  <YAxis tick={{fontSize:11,fill:'var(--text-muted)'}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={tooltipStyle} formatter={v=>[v.toLocaleString(),'Steps']}/>
                  <ReferenceLine y={stepGoal} stroke="#10B981" strokeDasharray="4 4" label={{value:`${(stepGoal/1000)}k`,fill:'#10B981',fontSize:10}}/>
                  <Bar dataKey="steps" fill="#06B6D4" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* recent gym */}
          {manualWorkouts.length > 0 && (
            <Card>
              <h3 style={{ fontFamily:'Syne, sans-serif', fontWeight:'700', fontSize:'14px', marginBottom:'12px' }}>🏋️ Recent Gym Sessions</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {[...manualWorkouts].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(w=>(
                  <div key={w.id} style={{ display:'flex', alignItems:'flex-start', gap:'12px', padding:'10px 12px', background:'var(--bg-secondary)', borderRadius:'10px' }}>
                    <div style={{ fontSize:'20px' }}>🏋️</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:'700', fontSize:'13px' }}>{w.title}</div>
                      <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{w.date} • {w.feeling}</div>
                      {Array.isArray(w.exercises) && w.exercises.slice(0,3).map((ex,i)=>(
                        <div key={i} style={{ fontSize:'11px', color:'var(--text-secondary)', marginTop:'2px' }}>💪 {ex.name}: {formatExSets(ex)}</div>
                      ))}
                      {w.notes && <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px', fontStyle:'italic' }}>"{w.notes}"</div>}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'4px' }}>
                      {w.totalVolume > 0 && <div style={{ fontSize:'12px', fontWeight:'700', color:'#EC4899' }}>{w.totalVolume}kg</div>}
                      <button onClick={()=>deleteManualWorkout(w.id)} style={deleteBtn}><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>}

        {/* ══════ BODY TAB ══════════════════════════════════════ */}
        {activeTab === 'body' && <>
          {latestLog && (
            <div style={{ display:'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap:'10px' }}>
              {Object.entries(METRIC_CONFIG).map(([key,cfg])=>(
                latestLog[key] != null && (
                  <Card key={key} style={{ padding:'14px', textAlign:'center' }}>
                    <div style={{ fontSize:'20px', marginBottom:'4px' }}>{cfg.icon}</div>
                    <div style={{ fontSize:'20px', fontWeight:'800', fontFamily:'JetBrains Mono, monospace', color:cfg.color }}>{latestLog[key]}{cfg.unit}</div>
                    <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>{cfg.label}</div>
                    {key==='weight' && <div style={{ fontSize:'11px', color: latestLog[key] <= weightGoal ? '#10B981' : '#F59E0B', marginTop:'2px' }}>goal: {weightGoal}{cfg.unit}</div>}
                  </Card>
                )
              ))}
            </div>
          )}

          {(metricHistory.weight||[]).length > 1 && (
            <Card>
              <h3 style={{ fontFamily:'Syne, sans-serif', fontWeight:'700', fontSize:'14px', marginBottom:'14px' }}>Weight Trend</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={metricHistory.weight} margin={{top:5,right:10,bottom:0,left:-20}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                  <XAxis dataKey="date" tick={{fontSize:11,fill:'var(--text-muted)'}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                  <YAxis tick={{fontSize:11,fill:'var(--text-muted)'}} axisLine={false} tickLine={false} domain={['auto','auto']}/>
                  <Tooltip contentStyle={tooltipStyle} formatter={v=>[`${v} kg`,'Weight']}/>
                  <ReferenceLine y={weightGoal} stroke="#10B981" strokeDasharray="4 4" label={{value:'Goal',fill:'#10B981',fontSize:11}}/>
                  <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2.5} dot={{fill:'#3B82F6',r:3}} activeDot={{r:5}}/>
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {last14Steps.some(d=>d.steps>0) && (
            <Card>
              <h3 style={{ fontFamily:'Syne, sans-serif', fontWeight:'700', fontSize:'14px', marginBottom:'14px' }}>Daily Steps</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={last14Steps} margin={{top:0,right:0,bottom:0,left:-10}}>
                  <XAxis dataKey="day" tick={{fontSize:11,fill:'var(--text-muted)'}} axisLine={false} tickLine={false} interval={2}/>
                  <YAxis tick={{fontSize:11,fill:'var(--text-muted)'}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={tooltipStyle} formatter={v=>[v.toLocaleString(),'Steps']}/>
                  <ReferenceLine y={stepGoal} stroke="#10B981" strokeDasharray="4 4" label={{value:`${stepGoal/1000}k goal`,fill:'#10B981',fontSize:10}}/>
                  <Bar dataKey="steps" fill="#06B6D4" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {bodyLogs.length > 0 && (
            <Card>
              <h3 style={{ fontFamily:'Syne, sans-serif', fontWeight:'700', fontSize:'14px', marginBottom:'12px' }}>Log History</h3>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', fontSize:'12px', borderCollapse:'collapse' }}>
                  <thead><tr style={{ borderBottom:'1px solid var(--border)' }}>
                    {['Date','Weight','Steps','Fat%','Source',''].map(h=>(
                      <th key={h} style={{ padding:'8px 10px', textAlign:'left', color:'var(--text-muted)', fontWeight:'700', fontSize:'11px', textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {[...bodyLogs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,15).map(l=>(
                      <tr key={l.id} style={{ borderBottom:'1px solid var(--border)' }}>
                        <td style={{ padding:'8px 10px', fontFamily:'JetBrains Mono, monospace' }}>{l.date}</td>
                        <td style={{ padding:'8px 10px', fontWeight:'700', color:'#3B82F6' }}>{l.weight?`${l.weight}kg`:'—'}</td>
                        <td style={{ padding:'8px 10px', color:'#06B6D4' }}>{l.steps?l.steps.toLocaleString():'—'}</td>
                        <td style={{ padding:'8px 10px' }}>{l.bodyFat?`${l.bodyFat}%`:'—'}</td>
                        <td style={{ padding:'8px 10px', fontSize:'11px', color:'var(--text-muted)' }}>{l.source||'manual'}</td>
                        <td style={{ padding:'8px 10px' }}><button onClick={()=>deleteBodyLog(l.id)} style={deleteBtn}><Trash2 size={14}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {bodyLogs.length === 0 && (
            <div style={{ textAlign:'center', padding:'48px', color:'var(--text-muted)' }}>
              <div style={{ fontSize:'48px', marginBottom:'12px' }}>⚖️</div>
              <div style={{ fontWeight:'600', color:'var(--text-secondary)', fontSize:'15px' }}>No body metrics yet</div>
              <Button onClick={()=>setActiveTab('today')} style={{ marginTop:'16px' }}><Activity size={14}/> Go to Today</Button>
            </div>
          )}
        </>}

        {/* ══════ NUTRITION TAB ════════════════════════════════ */}
        {activeTab === 'nutrition' && <>
          {avgNutrition && (
            <div style={{ display:'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap:'10px' }}>
              {[
                {key:'calories',label:'Avg Cal',unit:'kcal',goal:calorieGoal},
                {key:'protein',label:'Avg Pro',unit:'g',goal:proteinGoal},
                {key:'carbs',label:'Avg Carbs',unit:'g',goal:250},
                {key:'fat',label:'Avg Fat',unit:'g',goal:70},
              ].map(({key,label,unit,goal})=>(
                <Card key={key} style={{ padding:'12px', textAlign:'center' }}>
                  <div style={{ fontSize:'16px', fontWeight:'800', fontFamily:'JetBrains Mono, monospace', color:MACRO_COLORS[key] }}>{avgNutrition[key]}{unit}</div>
                  <div style={{ fontSize:'10px', color:'var(--text-muted)', marginTop:'2px' }}>{label}</div>
                  <div style={{ fontSize:'10px', color: avgNutrition[key]>=goal*0.9&&avgNutrition[key]<=goal*1.1?'#10B981':'#F59E0B', marginTop:'1px' }}>goal {goal}{unit}</div>
                </Card>
              ))}
            </div>
          )}

          <Button onClick={()=>openNutritionModal()} style={{ width:'100%' }}><Plus size={14}/> Log Food / Macros</Button>

          {last14Nutrition.some(d=>d.calories>0) ? (<>
            <Card>
              <h3 style={{ fontFamily:'Syne, sans-serif', fontWeight:'700', fontSize:'14px', marginBottom:'14px' }}>Calories (14 days)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={last14Nutrition} margin={{top:5,right:10,bottom:0,left:-10}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                  <XAxis dataKey="day" tick={{fontSize:10,fill:'var(--text-muted)'}} axisLine={false} tickLine={false} interval={2}/>
                  <YAxis tick={{fontSize:11,fill:'var(--text-muted)'}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={tooltipStyle} formatter={v=>[`${v} kcal`,'Calories']}/>
                  <ReferenceLine y={calorieGoal} stroke="#10B981" strokeDasharray="4 4" label={{value:'Goal',fill:'#10B981',fontSize:10}}/>
                  <Bar dataKey="calories" fill="#F97316" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <h3 style={{ fontFamily:'Syne, sans-serif', fontWeight:'700', fontSize:'14px', marginBottom:'14px' }}>Protein (14 days)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={last14Nutrition} margin={{top:5,right:10,bottom:0,left:-20}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                  <XAxis dataKey="day" tick={{fontSize:10,fill:'var(--text-muted)'}} axisLine={false} tickLine={false} interval={2}/>
                  <YAxis tick={{fontSize:11,fill:'var(--text-muted)'}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={tooltipStyle} formatter={v=>[`${v}g`,'Protein']}/>
                  <ReferenceLine y={proteinGoal} stroke="#10B981" strokeDasharray="4 4" label={{value:`${proteinGoal}g goal`,fill:'#10B981',fontSize:10}}/>
                  <Line type="monotone" dataKey="protein" stroke="#10B981" strokeWidth={2.5} dot={{fill:'#10B981',r:3}}/>
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* nutrition log history */}
            <Card>
              <h3 style={{ fontFamily:'Syne, sans-serif', fontWeight:'700', fontSize:'14px', marginBottom:'12px' }}>Nutrition Log</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {[...nutrition].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,15).map(n=>(
                  <div key={n.id} style={{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'10px 12px', background:'var(--bg-secondary)', borderRadius:'10px' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', gap:'12px', alignItems:'center', flexWrap:'wrap' }}>
                        <span style={{ fontSize:'12px', fontFamily:'JetBrains Mono, monospace', color:'var(--text-muted)' }}>{n.date}</span>
                        <span style={{ fontSize:'13px', fontWeight:'700', color:'#F97316' }}>{n.calories||0}kcal</span>
                        <span style={{ fontSize:'13px', fontWeight:'700', color:'#10B981' }}>{n.protein||0}g pro</span>
                        {n.carbs>0 && <span style={{ fontSize:'12px', color:'var(--text-muted)' }}>{n.carbs}g carbs</span>}
                        {n.fat>0 && <span style={{ fontSize:'12px', color:'var(--text-muted)' }}>{n.fat}g fat</span>}
                        <span style={{ fontSize:'10px', padding:'2px 6px', borderRadius:'4px', background:'rgba(148,163,184,0.1)', color:'var(--text-muted)' }}>{n.source||'manual'}</span>
                      </div>
                      {Array.isArray(n.meals) && n.meals.map((m,i)=>(
                        <div key={i} style={{ fontSize:'11px', color:'var(--text-secondary)', marginTop:'3px' }}>🍽️ {m.type}: {m.food}</div>
                      ))}
                    </div>
                    <button onClick={()=>deleteNutritionEntry(n.id)} style={deleteBtn}><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            </Card>
          </>) : (
            <div style={{ textAlign:'center', padding:'48px', color:'var(--text-muted)' }}>
              <div style={{ fontSize:'48px', marginBottom:'12px' }}>🥗</div>
              <div style={{ fontWeight:'600', color:'var(--text-secondary)', fontSize:'15px' }}>No nutrition data yet</div>
              <div style={{ display:'flex', gap:'8px', justifyContent:'center', marginTop:'16px' }}>
                <Button onClick={()=>openNutritionModal()}><Plus size={14}/> Log Food</Button>
                <Button variant="secondary" onClick={()=>{setShowImportModal(true);setImportStatus(null)}}><Upload size={14}/> Import</Button>
              </div>
            </div>
          )}
        </>}

        {/* ══════ WORKOUTS TAB ════════════════════════════════ */}
        {activeTab === 'workouts' && <>
          <div style={{ display:'flex', gap:'8px' }}>
            <Button onClick={()=>openGymModal()} style={{ flex:1 }}><Plus size={14}/> Log Gym Session</Button>
            <Button variant="secondary" onClick={()=>{setShowImportModal(true);setImportStatus(null)}}><Upload size={15}/> Import Hevy</Button>
          </div>

          {manualWorkouts.length > 0 && (
            <Card>
              <h3 style={{ fontFamily:'Syne, sans-serif', fontWeight:'700', fontSize:'14px', marginBottom:'12px' }}>✍️ Gym Journal</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {[...manualWorkouts].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20).map(w=>(
                  <div key={w.id} style={{ padding:'12px', background:'var(--bg-secondary)', borderRadius:'10px', border:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}>
                      <div>
                        <div style={{ fontWeight:'700', fontSize:'14px' }}>{w.title}</div>
                        <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>{w.date} • {w.feeling}</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        {w.totalVolume > 0 && <div style={{ fontSize:'14px', fontFamily:'JetBrains Mono, monospace', color:'#EC4899', fontWeight:'700' }}>{w.totalVolume}kg</div>}
                        <button onClick={()=>openGymModal(w)} style={{ ...deleteBtn, color:'var(--text-secondary)', fontSize:'12px' }}>Edit</button>
                        <button onClick={()=>deleteManualWorkout(w.id)} style={deleteBtn}><Trash2 size={14}/></button>
                      </div>
                    </div>
                    {Array.isArray(w.exercises) && w.exercises.length > 0 && (
                      <div style={{ display:'flex', flexDirection:'column', gap:'3px', marginTop:'4px' }}>
                        {w.exercises.map((ex,i) => (
                          <div key={i} style={{ fontSize:'12px', color:'var(--text-secondary)' }}>
                            💪 <strong>{ex.name}</strong> — {formatExSets(ex)}
                          </div>
                        ))}
                      </div>
                    )}
                    {typeof w.exercises === 'string' && w.exercises && <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'6px' }}>📝 {w.exercises}</div>}
                    {w.notes && <div style={{ fontSize:'12px', color:'var(--text-muted)', fontStyle:'italic', marginTop:'4px' }}>"{w.notes}"</div>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {hevyWorkouts.length > 0 && <>
            <Card>
              <h3 style={{ fontFamily:'Syne, sans-serif', fontWeight:'700', fontSize:'14px', marginBottom:'14px' }}>Volume (14 days)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={hevyVolumeData} margin={{top:0,right:0,bottom:0,left:-10}}>
                  <XAxis dataKey="day" tick={{fontSize:10,fill:'var(--text-muted)'}} axisLine={false} tickLine={false} interval={2}/>
                  <YAxis tick={{fontSize:11,fill:'var(--text-muted)'}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={tooltipStyle} formatter={v=>[`${v}kg`,'Volume']}/>
                  <Bar dataKey="volume" fill="#EC4899" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <h3 style={{ fontFamily:'Syne, sans-serif', fontWeight:'700', fontSize:'14px', marginBottom:'12px' }}>📱 Hevy Workouts</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {[...hevyWorkouts].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10).map(w=>(
                  <Card key={w.id}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
                      <div>
                        <div style={{ fontWeight:'700', fontSize:'14px' }}>{w.title}</div>
                        <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>{w.date} • {w.exercises?.length} exercises</div>
                      </div>
                      <div style={{ fontSize:'13px', fontFamily:'JetBrains Mono, monospace', color:'#EC4899', fontWeight:'700' }}>
                        {Math.round(w.exercises?.reduce((a,ex)=>a+ex.sets.reduce((s,set)=>s+set.reps*set.weight,0),0)||0)}kg
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                      {w.exercises?.slice(0,5).map((ex,i)=>(
                        <span key={i} style={{ padding:'3px 10px', background:'var(--bg-secondary)', borderRadius:'20px', fontSize:'12px', color:'var(--text-secondary)' }}>{ex.name} ({ex.sets.length}×)</span>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </>}

          {manualWorkouts.length===0 && hevyWorkouts.length===0 && (
            <div style={{ textAlign:'center', padding:'48px', color:'var(--text-muted)' }}>
              <div style={{ fontSize:'48px', marginBottom:'12px' }}>🏋️</div>
              <div style={{ fontWeight:'600', color:'var(--text-secondary)', fontSize:'15px' }}>No workouts yet</div>
              <div style={{ fontSize:'13px', marginTop:'4px' }}>Log your gym sessions or import from Hevy</div>
            </div>
          )}
        </>}

        {/* ══════ OVERVIEW TAB ════════════════════════════════ */}
        {activeTab === 'overview' && <>
          <div style={{ display:'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap:'12px' }}>
            {[
              {label:'Body Logs',value:bodyLogs.length,icon:'⚖️',color:'#3B82F6'},
              {label:'Nutrition Days',value:nutrition.length,icon:'🥗',color:'#F97316'},
              {label:'Gym Sessions',value:manualWorkouts.length+hevyWorkouts.length,icon:'🏋️',color:'#EC4899'},
              {label:'Latest Weight',value:latestLog?.weight?`${latestLog.weight}kg`:'—',icon:'📊',color:'#10B981'},
            ].map(({label,value,icon,color})=>(
              <Card key={label} style={{ padding:'16px', textAlign:'center' }}>
                <div style={{ fontSize:'28px', marginBottom:'6px' }}>{icon}</div>
                <div style={{ fontSize:'20px', fontWeight:'800', fontFamily:'JetBrains Mono, monospace', color }}>{value}</div>
                <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>{label}</div>
              </Card>
            ))}
          </div>

          <Card>
            <h3 style={{ fontFamily:'Syne, sans-serif', fontWeight:'700', fontSize:'14px', marginBottom:'14px' }}>Data Sources</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {[
                {name:'Manual Logs',icon:'✍️',desc:'Steps, weight, protein',connected:bodyLogs.some(l=>!l.source||l.source==='manual'),count:bodyLogs.filter(l=>!l.source||l.source==='manual').length+' entries'},
                {name:'Gym Journal',icon:'🏋️',desc:'Manual gym sessions',connected:manualWorkouts.length>0,count:manualWorkouts.length+' sessions'},
                {name:'Cronometer',icon:'🥗',desc:'Nutrition CSV',connected:nutrition.some(n=>n.source==='cronometer'),count:nutrition.filter(n=>n.source==='cronometer').length+' days'},
                {name:'Hevy',icon:'💪',desc:'Workout CSV',connected:hevyWorkouts.length>0,count:hevyWorkouts.length+' workouts'},
                {name:'Apple Health',icon:'🍎',desc:'Steps, weight XML',connected:bodyLogs.some(l=>l.source==='apple_health'),count:bodyLogs.filter(l=>l.source==='apple_health').length+' days'},
              ].map(({name,icon,desc,connected,count})=>(
                <div key={name} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px', background:'var(--bg-secondary)', borderRadius:'10px', border:`1px solid ${connected?'rgba(16,185,129,0.3)':'var(--border)'}` }}>
                  <div style={{ fontSize:'24px' }}>{icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'13px', fontWeight:'700' }}>{name}</div>
                    <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{desc}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'12px', fontWeight:'700', color: connected?'#10B981':'var(--text-muted)' }}>{connected?'✅ Active':'— Empty'}</div>
                    {connected && <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{count}</div>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>}

        {/* ══════ ENERGY TAB ═════════════════════════════════ */}
        {activeTab === 'energy' && <>
          {/* Energy quick log card */}
          <Card style={{ padding: '16px' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🔋 Log Current Energy
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5].map((lvl) => {
                  const colors = {
                    1: { bg: 'rgba(59, 130, 246, 0.1)', text: '#3B82F6', emoji: '😴', desc: 'Exhausted' },
                    2: { bg: 'rgba(99, 102, 241, 0.1)', text: '#6366F1', emoji: '📉', desc: 'Low' },
                    3: { bg: 'rgba(245, 158, 11, 0.1)', text: '#F59E0B', emoji: '😐', desc: 'Moderate' },
                    4: { bg: 'rgba(234, 179, 8, 0.1)', text: '#EAB308', emoji: '📈', desc: 'High' },
                    5: { bg: 'rgba(239, 68, 68, 0.1)', text: '#EF4444', emoji: '⚡', desc: 'Peak' },
                  }
                  const c = colors[lvl]
                  const isSelected = Number(energyLevel) === lvl
                  return (
                    <button
                      key={lvl}
                      onClick={() => { setEnergyLevel(lvl); playSubtleClick(); hapticLight(); }}
                      style={{
                        flex: '1 1 70px',
                        padding: '10px 4px',
                        borderRadius: '12px',
                        border: isSelected ? `2px solid ${c.text}` : '1px solid var(--border)',
                        background: isSelected ? c.bg : 'var(--bg-secondary)',
                        color: isSelected ? c.text : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>{c.emoji}</span>
                      <span style={{ fontSize: '11px', fontWeight: '700' }}>{c.desc}</span>
                    </button>
                  )
                })}
              </div>
              <div>
                <label style={labelStyle}>Context / Notes</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Just woke up, Post-lunch slump, Studying DSA..."
                  value={energyNotes}
                  onChange={(e) => setEnergyNotes(e.target.value)}
                />
              </div>
              <Button onClick={handleLogEnergy} disabled={!energyLevel}>
                <Plus size={15} /> Log Energy
              </Button>
            </div>
          </Card>

          {/* Energy Flow Rhythm Chart */}
          <Card>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>
              Energy Flow Rhythm
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Fluctuations by hour of day. Use this to schedule deep focus study blocks when your energy peaks!
            </p>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 10, right: 15, bottom: 5, left: -25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`Level ${v} / 5`, 'Average Energy']} />
                  <Line type="monotone" dataKey="avgLevel" stroke="#F59E0B" strokeWidth={3} dot={{ fill: '#F59E0B', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '12px' }}>
                🔋 Log energy levels throughout the day to build your productivity rhythm chart.
              </div>
            )}
          </Card>

          {/* History List */}
          <Card>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '700', fontSize: '14px', marginBottom: '12px' }}>
              Energy Log History
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
              {energyLogs.map((log) => {
                const colors = {
                  1: { emoji: '😴', desc: 'Exhausted', color: '#3B82F6' },
                  2: { emoji: '📉', desc: 'Low Energy', color: '#6366F1' },
                  3: { emoji: '😐', desc: 'Moderate', color: '#F59E0B' },
                  4: { emoji: '📈', desc: 'High Energy', color: '#EAB308' },
                  5: { emoji: '⚡', desc: 'Peak Performance', color: '#EF4444' },
                }
                const meta = colors[log.level] || { emoji: '🔋', desc: 'Energy', color: '#F59E0B' }
                return (
                  <div
                    key={log.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      fontSize: '13px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>{meta.emoji}</span>
                      <div>
                        <div style={{ fontWeight: '700', color: meta.color }}>
                          {meta.desc} (Level {log.level})
                        </div>
                        {log.notes && <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{log.notes}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '11px' }}>
                      <div>{log.date} {log.time}</div>
                      <button
                        onClick={() => {
                          const prev = energyLogs
                          setModule('health', { ...state.health, energyLogs: energyLogs.filter((l) => l.id !== log.id) })
                          showToast('Energy log deleted', 'warning', {
                            undo: () => setModule('health', { ...state.health, energyLogs: prev })
                          })
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          padding: '4px',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
              {energyLogs.length === 0 && (
                <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No energy logs recorded yet.
                </div>
              )}
            </div>
          </Card>
        </>}

      </div>


      {/* ═══════════════ MODALS ══════════════════════════════ */}

      {/* ── Body Metrics Modal ─────────────────────────────── */}
      <Modal isOpen={showLogModal} onClose={()=>setShowLogModal(false)} title="Log Body Metrics">
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <div><label style={labelStyle}>Date</label>
            <input style={inputStyle} type="date" value={logForm.date} onChange={e=>setLogForm(f=>({...f,date:e.target.value}))}/></div>
          <div><label style={labelStyle}>👣 Steps</label>
            <input style={inputStyle} type="number" inputMode="numeric" placeholder="e.g. 8500" value={logForm.steps} onChange={e=>setLogForm(f=>({...f,steps:e.target.value}))}/></div>
          <div style={{ display:'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap:'10px' }}>
            {Object.entries(METRIC_CONFIG).map(([key,cfg])=>(
              <div key={key}><label style={labelStyle}>{cfg.icon} {cfg.label} ({cfg.unit})</label>
                <input style={inputStyle} type="number" inputMode="numeric" step="0.1" placeholder={`e.g. ${key==='weight'?weightGoal:''}`}
                  value={logForm[key]} onChange={e=>setLogForm(f=>({...f,[key]:e.target.value}))}/></div>
            ))}
          </div>
          <div><label style={labelStyle}>Notes</label>
            <input style={inputStyle} placeholder="Any notes..." value={logForm.notes} onChange={e=>setLogForm(f=>({...f,notes:e.target.value}))}/></div>
          <Button onClick={saveBodyLog}>Save Metrics</Button>
        </div>
      </Modal>

      {/* ── Gym Log Modal (ENHANCED) ──────────────────────── */}
      <Modal isOpen={showGymModal} onClose={()=>setShowGymModal(false)} title="🏋️ Log Gym Session">
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <div style={{ display:'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap:'10px' }}>
            <div><label style={labelStyle}>Date</label>
              <input style={inputStyle} type="date" value={gymForm.date} onChange={e=>setGymForm(f=>({...f,date:e.target.value}))}/></div>
            <div><label style={labelStyle}>Day Type</label>
              <select style={inputStyle} value={gymForm.dayType} onChange={e=>setGymForm(f=>({...f,dayType:e.target.value}))}>
                {GYM_DAY_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select></div>
          </div>

          {gymForm.dayType==='Custom' && (
            <div><label style={labelStyle}>Custom Name</label>
              <input style={inputStyle} placeholder="e.g. Arms + Shoulders" value={gymForm.customName} onChange={e=>setGymForm(f=>({...f,customName:e.target.value}))}/></div>
          )}

          <div>
            <label style={labelStyle}>How was it? 💪</label>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
              {FEELING_OPTIONS.map(opt=>(
                <button key={opt} onClick={()=>setGymForm(f=>({...f,feeling:opt}))} style={{
                  padding:'6px 12px', borderRadius:'20px', cursor:'pointer', fontSize:'13px', fontFamily:'DM Sans, sans-serif',
                  border:`1px solid ${gymForm.feeling===opt?'#10B981':'var(--border)'}`,
                  background: gymForm.feeling===opt?'rgba(16,185,129,0.15)':'var(--bg-secondary)',
                  color: gymForm.feeling===opt?'#10B981':'var(--text-secondary)',
                  fontWeight: gymForm.feeling===opt?'700':'400',
                }}>{opt}</button>
              ))}
            </div>
          </div>

          {/* exercises */}
          <div>
            <label style={labelStyle}>Exercises</label>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {gymForm.exercises.map((ex,exIdx)=>(
                <div key={exIdx} style={{ padding:'12px', background:'var(--bg-secondary)', borderRadius:'12px', border:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
                    <input style={{ ...inputStyle, flex:1 }} placeholder="Exercise name (e.g. Bench Press)"
                      value={ex.name} onChange={e=>updateExName(exIdx,e.target.value)}/>
                    {gymForm.exercises.length > 1 && (
                      <button onClick={()=>removeExercise(exIdx)} style={deleteBtn}><X size={16}/></button>
                    )}
                  </div>
                  {ex.sets.map((set,sIdx)=>(
                    <div key={sIdx} style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'6px' }}>
                      <span style={{ fontSize:'11px', color:'var(--text-muted)', width:'40px' }}>Set {sIdx+1}</span>
                      <input style={smallInput} type="number" inputMode="numeric" placeholder="Reps"
                        value={set.reps} onChange={e=>updateSet(exIdx,sIdx,'reps',e.target.value)}/>
                      <span style={{ fontSize:'12px', color:'var(--text-muted)' }}>×</span>
                      <input style={smallInput} type="number" inputMode="decimal" placeholder="kg"
                        value={set.weight} onChange={e=>updateSet(exIdx,sIdx,'weight',e.target.value)}/>
                      <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>kg</span>
                      {ex.sets.length > 1 && (
                        <button onClick={()=>removeSet(exIdx,sIdx)} style={{ ...deleteBtn, padding:'2px' }}><X size={12}/></button>
                      )}
                    </div>
                  ))}
                  <button onClick={()=>addSet(exIdx)} style={{
                    background:'none', border:'1px dashed var(--border)', borderRadius:'8px',
                    padding:'6px 12px', color:'var(--text-muted)', fontSize:'12px', cursor:'pointer', width:'100%',
                  }}>+ Add Set</button>
                </div>
              ))}
            </div>
            <button onClick={addExercise} style={{
              marginTop:'8px', background:'none', border:'1px dashed rgba(16,185,129,0.4)',
              borderRadius:'10px', padding:'10px', color:'#10B981', fontSize:'13px', fontWeight:'700',
              cursor:'pointer', width:'100%',
            }}>+ Add Exercise</button>
          </div>

          {gymVolume > 0 && (
            <div style={{ padding:'10px 14px', background:'rgba(236,72,153,0.08)', borderRadius:'10px', border:'1px solid rgba(236,72,153,0.2)' }}>
              <span style={{ fontSize:'12px', color:'var(--text-muted)' }}>Total Volume: </span>
              <span style={{ fontSize:'16px', fontWeight:'800', fontFamily:'JetBrains Mono, monospace', color:'#EC4899' }}>{gymVolume} kg</span>
            </div>
          )}

          <div><label style={labelStyle}>Notes</label>
            <input style={inputStyle} placeholder="How did it go? PR? New exercise?" value={gymForm.notes} onChange={e=>setGymForm(f=>({...f,notes:e.target.value}))}/></div>
          <Button onClick={saveGymLog}>Save Gym Log</Button>
        </div>
      </Modal>

      {/* ── Nutrition Modal (ENHANCED) ────────────────────── */}
      <Modal isOpen={showNutritionModal} onClose={()=>setShowNutritionModal(false)} title="🥗 Log Food / Macros">
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <div><label style={labelStyle}>Date</label>
            <input style={inputStyle} type="date" value={nutritionForm.date} onChange={e=>setNutritionForm(f=>({...f,date:e.target.value}))}/></div>

          <div>
            <label style={labelStyle}>Meals</label>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {nutritionForm.meals.map((meal,idx)=>(
                <div key={idx} style={{ padding:'10px', background:'var(--bg-secondary)', borderRadius:'10px', border:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', gap:'6px', marginBottom:'6px', alignItems:'center' }}>
                    <select style={{ ...inputStyle, width:'120px', padding:'8px', fontSize:'12px' }} value={meal.type}
                      onChange={e=>updateMeal(idx,'type',e.target.value)}>
                      {MEAL_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                    <input style={{ ...inputStyle, flex:1, padding:'8px', fontSize:'13px' }} placeholder="What did you eat?"
                      value={meal.food} onChange={e=>updateMeal(idx,'food',e.target.value)}/>
                    {nutritionForm.meals.length > 1 && (
                      <button onClick={()=>removeMeal(idx)} style={deleteBtn}><X size={14}/></button>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:'8px' }}>
                    <div style={{ flex:1 }}>
                      <label style={{ ...labelStyle, fontSize:'10px', marginBottom:'2px' }}>🔥 Cal</label>
                      <input style={{ ...inputStyle, padding:'8px', fontSize:'13px' }} type="number" inputMode="numeric" placeholder="kcal"
                        value={meal.calories} onChange={e=>updateMeal(idx,'calories',e.target.value)}/>
                    </div>
                    <div style={{ flex:1 }}>
                      <label style={{ ...labelStyle, fontSize:'10px', marginBottom:'2px' }}>🥩 Pro</label>
                      <input style={{ ...inputStyle, padding:'8px', fontSize:'13px' }} type="number" inputMode="numeric" placeholder="g"
                        value={meal.protein} onChange={e=>updateMeal(idx,'protein',e.target.value)}/>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addMeal} style={{
              marginTop:'8px', background:'none', border:'1px dashed rgba(249,115,22,0.4)',
              borderRadius:'10px', padding:'10px', color:'#F97316', fontSize:'13px', fontWeight:'700',
              cursor:'pointer', width:'100%',
            }}>+ Add Meal</button>
          </div>

          {/* auto totals */}
          {mealTotals.calories > 0 && (
            <div style={{ padding:'10px 14px', background:'rgba(249,115,22,0.06)', borderRadius:'10px', border:'1px solid rgba(249,115,22,0.15)', display:'flex', gap:'16px' }}>
              <div><span style={{ fontSize:'11px', color:'var(--text-muted)' }}>Total Cal: </span><span style={{ fontWeight:'700', color:'#F97316' }}>{mealTotals.calories}</span></div>
              <div><span style={{ fontSize:'11px', color:'var(--text-muted)' }}>Total Pro: </span><span style={{ fontWeight:'700', color:'#10B981' }}>{mealTotals.protein}g</span></div>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap:'10px' }}>
            <div><label style={labelStyle}>🍞 Carbs (g)</label>
              <input style={inputStyle} type="number" inputMode="numeric" placeholder="e.g. 250"
                value={nutritionForm.carbs} onChange={e=>setNutritionForm(f=>({...f,carbs:e.target.value}))}/></div>
            <div><label style={labelStyle}>🥑 Fat (g)</label>
              <input style={inputStyle} type="number" inputMode="numeric" placeholder="e.g. 70"
                value={nutritionForm.fat} onChange={e=>setNutritionForm(f=>({...f,fat:e.target.value}))}/></div>
          </div>
          <div><label style={labelStyle}>Notes</label>
            <input style={inputStyle} placeholder="e.g. Cheat day, high protein..." value={nutritionForm.notes} onChange={e=>setNutritionForm(f=>({...f,notes:e.target.value}))}/></div>
          <Button onClick={saveNutritionLog}>Save Food Log</Button>
        </div>
      </Modal>

      {/* ── Import Modal ──────────────────────────────────── */}
      <Modal isOpen={showImportModal} onClose={()=>{setShowImportModal(false);setImportStatus(null)}} title="Import Health Data">
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          {[
            {name:'🥗 Cronometer',desc:'Nutrition CSV',hint:'Cronometer → Export Data',color:'#F97316',ref:cronometerRef,handler:handleCronometerImport,accept:'.csv'},
            {name:'🏋️ Hevy',desc:'Workout CSV',hint:'Hevy → Export Workout Data',color:'#EC4899',ref:hevyRef,handler:handleHevyImport,accept:'.csv'},
            {name:'🍎 Apple Health',desc:'Steps, weight XML',hint:'Health → Export All Health Data',color:'#EF4444',ref:appleRef,handler:handleAppleImport,accept:'.xml'},
          ].map(({name,desc,hint,color,ref,handler,accept})=>(
            <div key={name} style={{ padding:'14px', background:'var(--bg-secondary)', borderRadius:'12px', border:'1px solid var(--border)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontWeight:'700', fontSize:'14px' }}>{name}</div>
                  <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'2px' }}>{desc}</div>
                  <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>{hint}</div>
                </div>
                <button onClick={()=>ref.current?.click()} style={{
                  padding:'8px 14px', borderRadius:'8px', background:`${color}22`,
                  border:`1px solid ${color}66`, color, fontSize:'13px', fontWeight:'700',
                  cursor:'pointer', fontFamily:'DM Sans, sans-serif', flexShrink:0, marginLeft:'12px',
                }}>Upload</button>
                <input ref={ref} type="file" accept={accept} style={{ display:'none' }} onChange={handler}/>
              </div>
            </div>
          ))}
          {importStatus === 'reading' && <div style={{ padding:'12px', background:'rgba(99,102,241,0.1)', borderRadius:'10px', fontSize:'13px', color:'var(--accent-indigo)', textAlign:'center' }}>⏳ Processing...</div>}
          {importStatus?.startsWith('success') && <div style={{ padding:'12px', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:'10px', fontSize:'13px', color:'#10B981', textAlign:'center' }}>✅ Imported {importStatus.split(':')[1]} records!</div>}
          {importStatus === 'error' && <div style={{ padding:'12px', background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.3)', borderRadius:'10px', fontSize:'13px', color:'#F43F5E', textAlign:'center' }}>❌ Import failed. Check file format.</div>}
        </div>
      </Modal>

    </div>
  )
}

