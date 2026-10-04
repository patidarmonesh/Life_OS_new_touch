import { createServer } from 'node:http'
import handler from './routes.js'
try { process.loadEnvFile('.env') } catch (error) { if (error.code !== 'ENOENT') throw error }
const port = Number(process.env.API_PORT || 8787)
createServer(handler).listen(port, '127.0.0.1', () => process.stdout.write(`LifeOS API listening on http://127.0.0.1:${port}\n`))
