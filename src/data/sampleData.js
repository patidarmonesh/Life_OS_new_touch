import { v4 as uuid } from 'uuid'
import { subDays, format } from 'date-fns'

const today = new Date()
const d = (daysAgo) => format(subDays(today, daysAgo), 'yyyy-MM-dd')

// ── EXPENSES ──────────────────────────────────────────────
const CATEGORIES = ['Food & Drinks','Groceries','Transport','Gym & Fitness','Study & Education','Shopping','Bills & Utilities','Entertainment','Subscriptions','Personal Care','Miscellaneous']

function makeExpense(daysAgo, amount, category, desc, method = 'UPI', impulsive = false) {
  return { id: uuid(), amount, currency: 'INR', category, description: desc,
    date: d(daysAgo), time: `${10 + Math.floor(Math.random()*10)}:${String(Math.floor(Math.random()*60)).padStart(2,'0')}`,
    paymentMethod: method, isImpulsive: impulsive, isRecurring: false, tags: [], billOCRText: null, createdAt: new Date().toISOString() }
}

export const sampleExpenses = [
  makeExpense(0, 120, 'Food & Drinks', 'Chai + samosa at canteen'),
  makeExpense(0, 350, 'Food & Drinks', 'Dinner at mess'),
  makeExpense(1, 450, 'Food & Drinks', 'Lunch at dhaba with friends'),
  makeExpense(1, 200, 'Transport', 'Auto to railway station'),
  makeExpense(2, 1200, 'Shopping', 'T-shirt from Myntra', 'Card', true),
  makeExpense(2, 180, 'Food & Drinks', 'Maggi and juice'),
  makeExpense(3, 500, 'Groceries', 'Monthly groceries from BigBasket'),
  makeExpense(3, 99, 'Subscriptions', 'Spotify Premium'),
  makeExpense(4, 600, 'Gym & Fitness', 'Gym monthly fee', 'UPI'),
  makeExpense(4, 250, 'Food & Drinks', 'Birthday treat for friend', 'Cash', true),
  makeExpense(5, 180, 'Transport', 'Ola cab to airport'),
  makeExpense(5, 320, 'Food & Drinks', 'Pizza with roommates', 'UPI', true),
  makeExpense(6, 150, 'Personal Care', 'Haircut'),
  makeExpense(7, 2000, 'Study & Education', 'Coursera course', 'Card'),
  makeExpense(7, 400, 'Food & Drinks', 'Weekend brunch'),
  makeExpense(8, 350, 'Entertainment', 'Movie ticket', 'Card', true),
  makeExpense(9, 180, 'Food & Drinks', 'Chai sessions x4'),
  makeExpense(10, 750, 'Shopping', 'Stationery and notebook', 'UPI'),
  makeExpense(11, 120, 'Transport', 'Rickshaw x3'),
  makeExpense(12, 499, 'Subscriptions', 'Amazon Prime'),
  makeExpense(13, 280, 'Food & Drinks', 'Mess lunch + snacks'),
  makeExpense(14, 1500, 'Shopping', 'Shoes', 'Card', true),
  makeExpense(15, 200, 'Groceries', 'Fruits and milk'),
  makeExpense(16, 450, 'Food & Drinks', 'Outside dinner'),
  makeExpense(17, 300, 'Transport', 'Train ticket'),
  makeExpense(18, 600, 'Entertainment', 'Concert tickets', 'UPI', true),
  makeExpense(19, 150, 'Food & Drinks', 'Canteen breakfast'),
  makeExpense(20, 800, 'Study & Education', 'Books from Amazon'),
  makeExpense(21, 350, 'Food & Drinks', 'Friday lunch treat'),
  makeExpense(22, 250, 'Personal Care', 'Medicines'),
]

// ── STUDY SESSIONS ────────────────────────────────────────
function makeSession(daysAgo, subject, topic, hours, focus = 4) {
  const start = `0${8 + Math.floor(Math.random()*4)}:00`
  const end = `${8 + Math.floor(Math.random()*4) + Math.ceil(hours)}:00`
  return { id: uuid(), date: d(daysAgo), subject, topic, type: 'Lecture',
    startTime: start, endTime: end, durationMinutes: Math.round(hours * 60),
    focusScore: focus, distractions: '', notes: '', timerMode: 'pomodoro',
    pomodorosCompleted: Math.floor(hours / 0.5), createdAt: new Date().toISOString() }
}

export const sampleSessions = [
  makeSession(0, 'Machine Learning', 'Transformers', 3, 5),
  makeSession(0, 'DSA', 'Dynamic Programming', 1.5, 4),
  makeSession(1, 'Machine Learning', 'Attention Mechanism', 4, 5),
  makeSession(1, 'Deep RL', 'PPO Algorithm', 2, 4),
  makeSession(2, 'DSA', 'Graph Algorithms', 3, 3),
  makeSession(3, 'Deep RL', 'SAC Implementation', 5, 5),
  makeSession(4, 'Machine Learning', 'CNNs', 2, 4),
  makeSession(4, 'DSA', 'Trees', 1.5, 3),
  makeSession(5, 'Deep RL', 'DQN Paper Review', 4, 5),
  makeSession(6, 'Machine Learning', 'Revision', 1, 2),
  makeSession(7, 'DSA', 'Competitive Coding', 3, 4),
  makeSession(8, 'Deep RL', 'A3C Implementation', 4.5, 5),
  makeSession(9, 'Machine Learning', 'RNNs & LSTMs', 3, 4),
  makeSession(10, 'DSA', 'Backtracking', 2, 3),
  makeSession(11, 'Deep RL', 'Reward Shaping', 3.5, 4),
  makeSession(12, 'Machine Learning', 'GANs', 4, 5),
  makeSession(13, 'DSA', 'Segment Trees', 2.5, 4),
  makeSession(14, 'Deep RL', 'Environment Setup', 2, 3),
  makeSession(15, 'Machine Learning', 'SVM', 3, 4),
  makeSession(16, 'DSA', 'Mock Interview', 2, 4),
  makeSession(17, 'Deep RL', 'Policy Gradient', 4, 5),
  makeSession(18, 'Machine Learning', 'Clustering', 2.5, 3),
  makeSession(19, 'DSA', 'Heaps & Priority Queues', 1.5, 3),
  makeSession(20, 'Deep RL', 'DDQN vs D3QN', 3, 4),
]

// ── HABITS / CHECKPOINTS ─────────────────────────────────
export const sampleCheckpoints = [
  { id: 'h1', title: 'Morning Workout', description: '6am gym session', type: 'daily', category: 'Health', priority: 'high', reminderTime: '06:00', startDate: d(45), isActive: true, color: '#10B981', icon: '💪', createdAt: new Date().toISOString() },
  { id: 'h2', title: 'No reels before 8 PM', description: 'Avoid social media in morning', type: 'daily', category: 'Habit', priority: 'high', reminderTime: '21:00', startDate: d(30), isActive: true, color: '#F43F5E', icon: '📵', createdAt: new Date().toISOString() },
  { id: 'h3', title: 'Read 20 mins', description: 'Non-technical reading', type: 'daily', category: 'Personal', priority: 'medium', reminderTime: '22:00', startDate: d(20), isActive: true, color: '#8B5CF6', icon: '📚', createdAt: new Date().toISOString() },
  { id: 'h4', title: 'Meditate 10 mins', description: 'Morning mindfulness', type: 'daily', category: 'Mental', priority: 'medium', reminderTime: '07:00', startDate: d(15), isActive: true, color: '#F59E0B', icon: '🧘', createdAt: new Date().toISOString() },
  { id: 'h5', title: '2L Water', description: 'Stay hydrated', type: 'daily', category: 'Health', priority: 'low', reminderTime: '20:00', startDate: d(10), isActive: true, color: '#06B6D4', icon: '💧', createdAt: new Date().toISOString() },
]

// ── HABIT LOGS ────────────────────────────────────────────
export const sampleHabitLogs = []
for (let day = 0; day <= 30; day++) {
  sampleCheckpoints.forEach(cp => {
    const rand = Math.random()
    const status = rand > 0.25 ? 'done' : rand > 0.1 ? 'skipped' : 'failed'
    sampleHabitLogs.push({ id: uuid(), checkpointId: cp.id, date: d(day), status, value: null, note: '', loggedAt: new Date().toISOString() })
  })
}

// ── TIME FLOW ENTRIES ─────────────────────────────────────
function makeEntry(daysAgo, start, end, name, category, productivity, isWaste = false) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return { id: uuid(), date: d(daysAgo), start, end, durationMinutes: (eh * 60 + em) - (sh * 60 + sm),
    name, category, productivityScore: productivity, mood: Math.ceil(productivity / 1.2), isWaste, isBadHabit: isWaste, notes: '', source: 'manual', createdAt: new Date().toISOString() }
}

export const sampleTimeEntries = [
  makeEntry(0, '06:00', '07:00', 'Morning Workout', 'Exercise', 5),
  makeEntry(0, '07:00', '07:30', 'Bath + Breakfast', 'Morning Routine', 3),
  makeEntry(0, '08:00', '12:00', 'Deep RL Study', 'Study', 5),
  makeEntry(0, '12:00', '13:00', 'Lunch', 'Meals', 3),
  makeEntry(0, '13:00', '14:00', 'Instagram Reels', 'Social Media', 1, true),
  makeEntry(0, '14:00', '18:00', 'ML Assignment', 'Study', 4),
  makeEntry(0, '22:00', '23:30', 'Sleep', 'Sleep', 3),
  makeEntry(1, '06:00', '07:00', 'Gym', 'Exercise', 5),
  makeEntry(1, '08:00', '11:00', 'PPO Implementation', 'Deep Work', 5),
  makeEntry(1, '11:30', '12:30', 'YouTube random', 'Entertainment', 2, true),
  makeEntry(1, '13:00', '17:00', 'DSA Practice', 'Study', 4),
  makeEntry(1, '23:00', '07:00', 'Sleep', 'Sleep', 4),
  makeEntry(2, '09:00', '13:00', 'Research Paper Reading', 'Deep Work', 5),
  makeEntry(2, '14:00', '16:00', 'Reels + YouTube', 'Social Media', 1, true),
  makeEntry(2, '16:00', '19:00', 'Coding Practice', 'Study', 4),
]

// ── JOURNAL ENTRIES ───────────────────────────────────────
export const sampleJournal = [
  { id: uuid(), date: d(0), content: 'Productive day today. Finished the PPO implementation and it\'s finally converging. Spent too much time on reels in the afternoon though — need to fix that. Gym was solid, hit a new PR on bench press.', dayRating: 4, mood: 'productive', moodIntensity: 4, gratitude: ['Good health', 'Making progress on RL project', 'Friends support'], tomorrowIntention: 'Finish attention mechanism chapter', aiAnalysis: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: uuid(), date: d(1), content: 'Woke up late. Missed morning workout. Studied ML for 4 hours but kept getting distracted by phone. Need to put it in another room. Evening was better — solved 3 DSA problems.', dayRating: 3, mood: 'neutral', moodIntensity: 3, gratitude: ['Solved hard DSA problem', 'Good food today', 'Nice weather'], tomorrowIntention: 'Wake up at 6am and gym first thing', aiAnalysis: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: uuid(), date: d(2), content: 'Best day this week. 5 hours of deep work on the RL project. No phone in morning. Gym was amazing. Finished reading a research paper end to end.', dayRating: 5, mood: 'great', moodIntensity: 5, gratitude: ['High focus session', 'Making real progress', 'Health and energy'], tomorrowIntention: 'Continue RL work + DSA mock interview', aiAnalysis: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
]

// ── HEALTH LOGS ───────────────────────────────────────────
export const sampleHealthLogs = Array.from({ length: 20 }, (_, i) => ({
  id: uuid(), date: d(i),
  steps: 5000 + Math.floor(Math.random() * 7000),
  sleepHours: 5.5 + Math.random() * 3,
  water: 1 + Math.random() * 2,
  mood: 2 + Math.floor(Math.random() * 4),
  energy: 2 + Math.floor(Math.random() * 4),
  weight: 68 + Math.random() * 2,
  createdAt: new Date().toISOString()
}))

// ── SETTINGS ─────────────────────────────────────────────
export const sampleSettings = {
  profile: { name: 'Ravish', avatar: '🧠', currency: '₹', timezone: 'Asia/Kolkata' },
  goals: { dailyStudyHours: 6, monthlyBudget: 8000, dailyWasteLimit: 2, sleepGoal: 8, dailySteps: 10000 },
  theme: 'dark',
  geminiApiKey: undefined,
  categories: { expense: [...CATEGORIES], time: ['Sleep','Morning Routine','Exercise','Study','Deep Work','Meals','Social Media','Entertainment','Travel','Self-Care','Waste Time','Other'] }
}