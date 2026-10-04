import { useState, useMemo } from 'react'
import { useAppState, useAppActions } from '../context/appHooks'
import Card from '../components/ui/Card'
import XPBar from '../components/ui/XPBar'
import Button from '../components/ui/Button'
import { calculateXP, getLevel } from '../utils/gamification'
import { getTodayDateKey } from '../utils/dateTime'
import { useToast } from '../context/toastContextCore'
import { playSuccessSound, playSubtleClick, playWarningBeep, playNoticeChime } from '../hooks/useAudio'
import { hapticSuccess, hapticWarning, hapticMedium, hapticLight } from '../hooks/useHaptic'
import { Shield, Sparkles, Sword, Zap, Brain, Trophy, Coins, Heart, Star, Compass, Smile } from 'lucide-react'

const LEVEL_TITLES = {
  1: 'Beginner', 2: 'Novice', 3: 'Apprentice', 4: 'Explorer',
  5: 'Achiever', 6: 'Challenger', 7: 'Specialist', 8: 'Veteran',
  9: 'Expert', 10: 'Master', 11: 'Champion', 12: 'Legend',
  13: 'Elite', 14: 'Titan', 15: 'Virtuoso', 16: 'Sage',
  17: 'Overlord', 18: 'Paragon', 19: 'Ascendant', 20: 'Mythic',
  21: 'Immortal', 22: 'Transcendent', 23: 'Celestial', 24: 'Divine',
  25: 'Absolute', 26: 'MAX',
}

const GEAR_BY_LEVEL = [
  { lv: 1,  weapon: '📝 Wooden Pencil', armor: '👕 Cotton Hoodie', trinket: '🥤 Tap Water' },
  { lv: 3,  weapon: '🖊️ Steel Ballpoint', armor: '🧥 Bomber Jacket', trinket: '☕ Black Coffee' },
  { lv: 6,  weapon: '✒️ Fountain Pen', armor: '🧥 Techwear Windbreaker', trinket: '🍵 Matcha Latte' },
  { lv: 10, weapon: '⌨️ Mechanical Keyboard', armor: '🥋 Indigo Blazer', trinket: '🧉 Yerba Mate' },
  { lv: 15, weapon: '💻 Ultra Laptop', armor: '🧥 Nanotech Suit', trinket: '🧠 Nootropic Stack' },
  { lv: 20, weapon: '⚡ Neural Implant', armor: '✨ Holographic Cloak', trinket: '🌌 Cosmic Elixir' },
  { lv: 25, weapon: '🛸 Absolute Quantum Core', armor: '🛡️ Aegis Power Armor', trinket: '🕉️ Geeta Wisdom Core' },
]

export default function RPG() {
  const state = useAppState()
  const { setModule } = useAppActions()
  const { showToast } = useToast()
  const timezone = state.settings?.profile?.timezone
  const today = getTodayDateKey(timezone)

  const [activeTab, setActiveTab] = useState('quests') // quests, boss, pet, achievements

  const xp = useMemo(() => calculateXP(state), [state])
  const level = useMemo(() => getLevel(xp), [xp])
  const title = LEVEL_TITLES[level] || 'Absolute'

  // Load RPG states or defaults
  const rpgState = state.rpg || {
    bossHp: 200,
    bossMaxHp: 200,
    activeBossIndex: 0,
    shields: 0,
    equippedPet: null,
    petEggXp: 0,
    eggHatched: false,
    unlockedBadges: [],
  }

  // Calculate Equipped Gear based on current level
  const equippedGear = useMemo(() => {
    let active = GEAR_BY_LEVEL[0]
    for (const gear of GEAR_BY_LEVEL) {
      if (level >= gear.lv) active = gear
    }
    return active
  }, [level])

  // RPG Attributes derived from real tracking logs
  const attributes = useMemo(() => {
    const bodyLogs = state.health?.bodyLogs || []
    const totalSteps = bodyLogs.reduce((sum, log) => sum + (Number(log.steps) || 0), 0)
    const str = Math.min(100, Math.max(10, Math.floor(totalSteps / 10000) + 10))

    const sessions = state.study?.sessions || []
    const totalStudyHours = sessions.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0) / 60
    const intel = Math.min(100, Math.max(10, Math.floor(totalStudyHours * 1.5) + 10))

    const expenses = state.finance?.expenses || []
    const wth = Math.min(100, Math.max(10, 80 - Math.min(50, expenses.length * 0.5)))

    const journalEntries = state.journal?.entries || []
    const sleepLogs = bodyLogs.filter(l => l.sleepHours)
    const avgSleep = sleepLogs.length ? (sleepLogs.reduce((a, l) => a + Number(l.sleepHours), 0) / sleepLogs.length) : 7
    const spr = Math.min(100, Math.max(10, (journalEntries.length * 3) + Math.round(avgSleep * 5)))

    const timeflowEntries = state.timeflow?.entries || []
    const productiveHrs = timeflowEntries.filter(e => !e.isWaste).reduce((a, e) => a + (Number(e.durationMinutes) || 0), 0) / 60
    const prd = Math.min(100, Math.max(10, Math.floor(productiveHrs * 2) + 10))

    return { str, int: intel, wth, spr, prd }
  }, [state])

  // Quests list
  const quests = useMemo(() => {
    const preferences = state.settings?.preferences || {}
    const todayLogs = (state.habits?.dailyLogs || []).filter(l => l.date === today)
    const completedHabits = todayLogs.filter(l => l.status === 'done').length
    const todayStudy = (state.study?.sessions || []).filter(s => s.date === today)
    const studyHoursToday = todayStudy.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0) / 60
    const todayBodyLog = (state.health?.bodyLogs || []).find(l => l.date === today) || {}
    const stepsToday = todayBodyLog.steps || 0
    const todayExpenses = (state.finance?.expenses || []).filter(e => e.date === today)
    const todaySpend = todayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    const dailyBudget = Math.round((preferences.monthlyBudget || 15000) / 30)
    const todayJournalEntry = (state.journal?.entries || []).some(j => j.date === today)

    return [
      { id: 'q_steps', title: 'Active Nomad', desc: 'Walk 8,000 steps today', progress: `${stepsToday.toLocaleString()} / 8,000`, isDone: stepsToday >= 8000, xp: 50 },
      { id: 'q_study', title: 'Library Hermit', desc: 'Log at least 1 hour of study time today', progress: `${studyHoursToday.toFixed(1)}h / 1.0h`, isDone: studyHoursToday >= 1.0, xp: 60 },
      { id: 'q_finance', title: 'Thrifty Sage', desc: `Stay under today's budget limit`, progress: `Spend: ₹${todaySpend} / Limit: ₹${dailyBudget}`, isDone: todaySpend <= dailyBudget, xp: 40 },
      { id: 'q_habits', title: 'Discipline Master', desc: 'Complete at least 2 habits today', progress: `${completedHabits} / 2 completed`, isDone: completedHabits >= 2, xp: 50 },
      { id: 'q_journal', title: 'Self Reflector', desc: 'Write today\'s journal entry', progress: todayJournalEntry ? 'Completed' : 'Pending', isDone: todayJournalEntry, xp: 40 },
    ]
  }, [state, today])

  const completedQuestsCount = quests.filter(q => q.isDone).length

  // Boss configurations
  const BOSSES = [
    { name: '👹 Procrastination Demon', desc: 'Attacks with Netflix doomscroll loops. Defeat him to unlock productivity focus.', maxHp: 200, reward: '🔥 Focus Badge' },
    { name: '🐉 Burnout Dragon', desc: 'Spits hot fire of sleep deprivation and overload. Shield up to survive.', maxHp: 400, reward: '🛡️ Aegis Shield Badge' },
    { name: '🧟 Chaos Specter', desc: 'Disorganizes schedules and scatter notes. Tame him with Second Brain.', maxHp: 600, reward: '🔮 Sage Rune Badge' }
  ]
  const currentBoss = BOSSES[rpgState.activeBossIndex] || BOSSES[0]

  // Boss Strike handler
  function handleBossStrike() {
    if (completedQuestsCount === 0) {
      showToast('You must complete at least 1 Quest today to strike the Boss!', 'warning')
      playWarningBeep()
      hapticWarning()
      return
    }

    const damage = completedQuestsCount * 50
    let nextHp = rpgState.bossHp - damage
    let nextBossIdx = rpgState.activeBossIndex
    let nextMax = rpgState.bossMaxHp

    playNoticeChime()
    hapticMedium()

    if (nextHp <= 0) {
      showToast(`🏆 Defeated ${currentBoss.name}! Earned reward: ${currentBoss.reward}!`, 'success')
      playSuccessSound()
      hapticSuccess()
      nextBossIdx = (rpgState.activeBossIndex + 1) % BOSSES.length
      const nextBoss = BOSSES[nextBossIdx]
      nextHp = nextBoss.maxHp
      nextMax = nextBoss.maxHp
    } else {
      showToast(`💥 Struck ${currentBoss.name} for ${damage} damage! HP: ${nextHp}/${rpgState.bossMaxHp}`, 'info')
    }

    setModule('rpg', {
      ...rpgState,
      bossHp: nextHp,
      bossMaxHp: nextMax,
      activeBossIndex: nextBossIdx,
    })
  }

  // Hatching & Pets handlers
  function handleFeedEgg() {
    // Egg requires 500 XP to hatch
    if (xp < 200) {
      showToast('You need at least 200 total XP to hatch eggs!', 'warning')
      return
    }
    if (rpgState.eggHatched) {
      showToast('Egg already hatched!', 'info')
      return
    }

    playSubtleClick()
    hapticLight()

    const addedXp = 100
    const nextEggXp = rpgState.petEggXp + addedXp

    if (nextEggXp >= 500) {
      const petList = ['🔥 Focus Phoenix (Buff: +10% Study XP)', '🐼 Pomo Panda (Buff: +5% Habit speed)', '🦊 Sleepy Fox (Buff: +10% Deep sleep)']
      const hatchedPet = petList[Math.floor(Math.random() * petList.length)]
      setModule('rpg', {
        ...rpgState,
        petEggXp: 500,
        eggHatched: true,
        equippedPet: hatchedPet,
      })
      showToast(`🥚 Egg Hatched! You got: ${hatchedPet}! 🎉`, 'success')
      playSuccessSound()
      hapticSuccess()
    } else {
      setModule('rpg', {
        ...rpgState,
        petEggXp: nextEggXp,
      })
      showToast(`🧪 Contributed 100 XP to Egg! Hatch progress: ${nextEggXp}/500`, 'info')
    }
  }

  // Buy Streak Shield
  function buyStreakShield() {
    if (xp < 150) {
      showToast('Need at least 150 XP to buy a Streak Shield', 'warning')
      return
    }

    setModule('rpg', {
      ...rpgState,
      shields: rpgState.shields + 1,
    })
    showToast('🛡️ Streak Shield purchased! Automatically guards habit failure risks.', 'success')
    playSuccessSound()
    hapticSuccess()
  }

  // Stats Polygon points
  const radarPolygonPoints = useMemo(() => {
    const values = [attributes.str, attributes.int, attributes.wth, attributes.spr, attributes.prd]
    const angles = [0, 72, 144, 216, 288]
    const centerX = 120
    const centerY = 120
    const radius = 80

    return angles.map((angle, idx) => {
      const val = values[idx]
      const radians = (angle * Math.PI) / 180 - Math.PI / 2
      const x = centerX + radius * (val / 100) * Math.cos(radians)
      const y = centerY + radius * (val / 100) * Math.sin(radians)
      return `${x},${y}`
    }).join(' ')
  }, [attributes])

  // Achievements checking logic
  const achievementsList = useMemo(() => {
    const studyHours = (state.study?.sessions || []).reduce((acc, s) => acc + (s.durationMinutes || 0), 0) / 60
    const totalSpent = (state.finance?.expenses || []).reduce((acc, e) => acc + (e.amount || 0), 0)
    const budget = state.settings?.preferences?.monthlyBudget || 15000
    const longestStreak = (state.habits?.checkpoints || []).reduce((max, c) => Math.max(max, c.streak || 0), 0)
    const meds = state.meditations?.sessions?.length || 0
    const water = state.health?.waterLogs?.length || 0

    return [
      { id: 'ach_1', title: 'Scholar\'s Path', desc: 'Focus for over 10 study hours', isDone: studyHours >= 10, target: '10 hrs', current: `${studyHours.toFixed(1)} hrs` },
      { id: 'ach_2', title: 'Frugal Master', desc: 'Stay under spending limits', isDone: totalSpent <= budget && totalSpent > 0, target: `< ₹${budget}`, current: `₹${totalSpent.toLocaleString()}` },
      { id: 'ach_3', title: 'Discipline Titan', desc: 'Achieve a habit streak of 5+ days', isDone: longestStreak >= 5, target: '5 Days', current: `${longestStreak} Days` },
      { id: 'ach_4', title: 'Zen Explorer', desc: 'Log at least 5 guided meditations', isDone: meds >= 5, target: '5 Meds', current: `${meds} Sessions` },
      { id: 'ach_5', title: 'Hydration Guru', desc: 'Track daily water intake 10 times', isDone: water >= 10, target: '10 Logs', current: `${water} logs` },
    ]
  }, [state])

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', paddingBottom: '48px' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem', margin: 0 }}>🏆 Life RPG Studio</h1>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Level up your real life, hatch companion pets, defend streaks, and slay procrastination monsters.
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', overflowX: 'auto' }}>
          {[
            { key: 'quests', label: '⚔️ Quests & Stats' },
            { key: 'boss', label: '👹 Boss Battles' },
            { key: 'pet', label: '🐾 Companion Pet & Shields' },
            { key: 'achievements', label: '🏆 Achievements' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { playSubtleClick(); setActiveTab(t.key); }}
              style={{
                background: activeTab === t.key ? 'rgba(99,102,241,0.12)' : 'transparent',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '10px',
                color: activeTab === t.key ? 'var(--accent-indigo)' : 'var(--text-muted)',
                fontWeight: activeTab === t.key ? '700' : '400',
                cursor: 'pointer',
                fontSize: '13px',
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB: QUESTS & STATS */}
        {activeTab === 'quests' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {/* Level Card */}
              <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ fontSize: '48px', width: '72px', height: '72px', borderRadius: '18px', background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.22)', display: 'grid', placeItems: 'center' }}>
                    🛡️
                  </div>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                      Level {level} {title}
                    </h2>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Rank: Accomplished Lifelogger
                    </div>
                  </div>
                </div>

                <XPBar />

                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '14px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    🛡️ Current Equipped Gear
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Weapon Slot:</span>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{equippedGear.weapon}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Armor Slot:</span>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{equippedGear.armor}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Trinket Slot:</span>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{equippedGear.trinket}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Attributes Radar Chart */}
              <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '14px', alignSelf: 'flex-start' }}>
                  📊 Stats Web (Radar Chart)
                </h3>
                <svg width="240" height="240" viewBox="0 0 240 240" style={{ overflow: 'visible' }}>
                  {[0.2, 0.4, 0.6, 0.8, 1].map((scale, i) => {
                    const r = 80 * scale
                    const pts = [0, 72, 144, 216, 288].map(angle => {
                      const radians = (angle * Math.PI) / 180 - Math.PI / 2
                      return `${120 + r * Math.cos(radians)},${120 + r * Math.sin(radians)}`
                    }).join(' ')
                    return <polygon key={i} points={pts} fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray={scale === 1 ? 'none' : '2 3'} />
                  })}
                  {[0, 72, 144, 216, 288].map((angle, i) => {
                    const radians = (angle * Math.PI) / 180 - Math.PI / 2
                    return <line key={i} x1="120" y1="120" x2={120 + 80 * Math.cos(radians)} y2={120 + 80 * Math.sin(radians)} stroke="var(--border)" strokeWidth="1" />
                  })}
                  <polygon points={radarPolygonPoints} fill="rgba(236,72,153,0.18)" stroke="var(--accent-indigo)" strokeWidth="2.5" />
                  {[
                    { name: `STR (${attributes.str})`, angle: 0 },
                    { name: `INT (${attributes.int})`, angle: 72 },
                    { name: `WTH (${attributes.wth})`, angle: 144 },
                    { name: `SPR (${attributes.spr})`, angle: 216 },
                    { name: `PRD (${attributes.prd})`, angle: 288 },
                  ].map(({ name, angle }, idx) => {
                    const radians = (angle * Math.PI) / 180 - Math.PI / 2
                    const values = [attributes.str, attributes.int, attributes.wth, attributes.spr, attributes.prd]
                    const val = values[idx]
                    const dotX = 120 + 80 * (val / 100) * Math.cos(radians)
                    const dotY = 120 + 80 * (val / 100) * Math.sin(radians)
                    const labelX = 120 + 96 * Math.cos(radians)
                    const labelY = 120 + 94 * Math.sin(radians)

                    return (
                      <g key={idx}>
                        <circle cx={dotX} cy={dotY} r="4" fill="#EC4899" stroke="#fff" strokeWidth="1" />
                        <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" style={{ fill: 'var(--text-secondary)', fontSize: '10px', fontFamily: 'monospace', fontWeight: '700' }}>
                          {name}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </Card>
            </div>

            {/* Daily Quests Board */}
            <Card style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '800', fontFamily: 'Syne, sans-serif', margin: 0 }}>⚔️ Active Daily Quests</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Reset at Midnight</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {quests.map((q, idx) => (
                  <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 14px', borderRadius: '12px', background: q.isDone ? 'rgba(16,185,129,0.06)' : 'var(--bg-secondary)', border: `1px solid ${q.isDone ? 'rgba(16,185,129,0.22)' : 'var(--border)'}` }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: q.isDone ? '#10B981' : 'rgba(255,255,255,0.05)', color: q.isDone ? '#fff' : 'var(--text-muted)', fontSize: '12px', fontWeight: 'bold' }}>
                      {q.isDone ? '✓' : idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: q.isDone ? '#10B981' : 'var(--text-primary)', textDecoration: q.isDone ? 'line-through' : 'none' }}>{q.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{q.desc} • {q.progress}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
                        +{q.xp} XP
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* TAB: BOSS BATTLES */}
        {activeTab === 'boss' && (
          <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
            <div style={{ fontSize: '72px', animation: 'float 3s ease-in-out infinite' }}>👹</div>
            <div>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '1.4rem', margin: 0 }}>{currentBoss.name}</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '420px', margin: '4px auto 16px' }}>{currentBoss.desc}</p>
            </div>

            {/* Boss HP Bar */}
            <div style={{ width: '100%', maxWidth: '440px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Boss HP: {rpgState.bossHp} / {rpgState.bossMaxHp}</span>
                <span style={{ color: '#EF4444' }}>{Math.max(0, Math.round((rpgState.bossHp / rpgState.bossMaxHp) * 100))}% HP</span>
              </div>
              <div style={{ height: '12px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.max(0, (rpgState.bossHp / rpgState.bossMaxHp) * 100)}%`, height: '100%', background: 'linear-gradient(90deg, #EF4444, #F43F5E)', borderRadius: '999px', transition: 'width 0.4s ease' }} />
              </div>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Completed Quests today: <strong>{completedQuestsCount} / 5</strong> (+{completedQuestsCount * 50} strike points)
            </div>

            <Button onClick={handleBossStrike} disabled={completedQuestsCount === 0} style={{ padding: '12px 28px', display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)', border: 'none', boxShadow: '0 4px 14px rgba(239,68,68,0.3)' }}>
              <Sword size={16} /> Strike Boss
            </Button>
          </Card>
        )}

        {/* TAB: COMPANION PET & SHIELDS */}
        {activeTab === 'pet' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {/* Companion Hatchery */}
            <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
              <div style={{ fontSize: '56px' }}>{rpgState.eggHatched ? '🐣' : '🥚'}</div>
              <div>
                <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '16px', margin: 0 }}>
                  {rpgState.eggHatched ? 'Hatched Companion' : 'Companion Incubator'}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {rpgState.eggHatched ? `Equipped: ${rpgState.equippedPet}` : 'Incubate a focus pet egg by contributing XP points.'}
                </p>
              </div>

              {!rpgState.eggHatched ? (
                <>
                  <div style={{ width: '100%', maxWidth: '280px', marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Incubate progress</span>
                      <span style={{ color: 'var(--accent-indigo)' }}>{rpgState.petEggXp} / 500 XP</span>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${(rpgState.petEggXp / 500) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #8B5CF6, #EC4899)', borderRadius: '999px' }} />
                    </div>
                  </div>
                  <Button variant="secondary" style={{ marginTop: '8px' }} onClick={handleFeedEgg}>
                    🧪 Feed 100 XP to Egg
                  </Button>
                </>
              ) : (
                <div style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.12)', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', color: '#34D399', fontWeight: '700', marginTop: '12px' }}>
                  Active Buff: {rpgState.equippedPet?.includes('Phoenix') ? '+10% Focus Hours XP' : rpgState.equippedPet?.includes('Pomo') ? '+5% Habit Score' : '+10% Sleep Efficiency'}
                </div>
              )}
            </Card>

            {/* Streak Shield Store */}
            <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
              <Shield size={48} color="var(--accent-cyan)" />
              <div>
                <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '800', fontSize: '16px', margin: 0 }}>Streak Shield Store</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Buy shields using your hard-earned XP. Defends streaks against weekend breaks and forgot check-ins.
                </p>
              </div>

              <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '8px' }}>
                Active Shields: {rpgState.shields}
              </div>

              <Button onClick={buyStreakShield} disabled={xp < 150} style={{ padding: '10px 20px', background: 'rgba(56,189,248,0.18)', border: '1px solid rgba(56,189,248,0.3)', color: '#38BDF8', width: '100%', marginTop: '8px' }}>
                🛡️ Buy Shield (150 XP)
              </Button>
            </Card>
          </div>
        )}

        {/* TAB: ACHIEVEMENTS */}
        {activeTab === 'achievements' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {achievementsList.map(ach => (
              <Card
                key={ach.id}
                style={{
                  padding: '14px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: ach.isDone ? 'rgba(234,179,8,0.03)' : 'var(--bg-secondary)',
                  border: `1px solid ${ach.isDone ? 'rgba(234,179,8,0.22)' : 'var(--border)'}`,
                  borderRadius: '16px',
                }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{
                    fontSize: '22px',
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: ach.isDone ? 'rgba(234,179,8,0.12)' : 'rgba(255,255,255,0.04)',
                    display: 'grid',
                    placeItems: 'center',
                    border: ach.isDone ? '1px solid rgba(234,179,8,0.3)' : '1px solid var(--border)',
                  }}>
                    {ach.isDone ? '🏅' : '🔒'}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: ach.isDone ? '#FBBF24' : 'var(--text-primary)' }}>
                      {ach.title}
                    </h4>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {ach.desc} (Target: {ach.target})
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: ach.isDone ? '#10B981' : 'var(--text-muted)' }}>
                    {ach.isDone ? 'Unlocked ✓' : `Progress: ${ach.current}`}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
