// test-db-wo-sdk.ts
import Database from 'better-sqlite3'
import { homedir } from 'os'

interface RawMessage {
    ROWID: number
    guid: string
    text: string | null
    attributedBody: Buffer | null
    handle_id: string
    is_from_me: number
    is_read: number
    date: number
    service: string
}

// Convert macOS iMessage timestamp (nanoseconds since 2001-01-01) to JS Date
function macTimeToDate(macTime: number): Date {
    const APPLE_EPOCH = 978307200 // seconds since Unix epoch to 2001-01-01
    const seconds = macTime / 1_000_000_000
    return new Date((APPLE_EPOCH + seconds) * 1000)
}

// Heuristic attributedBody decoder, adapted from known scripts [web:31][web:55]
function decodeAttributedBodyHeuristic(buffer: Buffer): string | null {
    if (!buffer || buffer.length === 0) return null

    // 1. Decode as UTF‑8 (with replacement chars if needed)
    let s = buffer.toString('utf8')

    // 2. Slice around common markers in attributedBody
    if (s.includes('NSNumber')) {
        s = s.split('NSNumber')[0]
    }
    if (s.includes('NSString')) {
        const parts = s.split('NSString')
        // if there's content after NSString, keep that
        if (parts.length > 1) s = parts[1]
    }
    if (s.includes('NSDictionary')) {
        s = s.split('NSDictionary')[0]
    }

    // 3. Strip fixed binary prefix/suffix bytes (empirically works well) [web:31][web:55]
    if (s.length > 18) {
        s = s.slice(6, -12)
    }

    // 4. Remove control characters and replacement chars
    s = s.replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    s = s.replace(/\uFFFD/g, '') // �

    // 5. Trim whitespace
    s = s.trim()

    return s.length > 0 ? s : null
}

async function main() {
    const dbPath = `${homedir()}/Library/Messages/chat.db`
    console.log('Opening database:', dbPath)
    console.log('')

    const db = new Database(dbPath, { readonly: true })

    try {
        const query = `
            SELECT 
                message.ROWID,
                message.guid,
                message.text,
                message.attributedBody,
                COALESCE(handle.id, 'me') as handle_id,
                message.is_from_me,
                message.is_read,
                message.date,
                message.service
            FROM message
            LEFT JOIN handle ON message.handle_id = handle.ROWID
            WHERE message.date IS NOT NULL
            ORDER BY message.date DESC
            LIMIT 10
        `

        const messages = db.prepare(query).all() as RawMessage[]

        console.log(`Found ${messages.length} messages. Messages are shown in descending chronological order.\n`)

        for (const msg of messages) {
            let finalText: string | null = null

            if (msg.text) {
                // Plain text column (older SMS or some messages)
                finalText = msg.text
            } else if (msg.attributedBody) {
                // Modern iMessage content lives here
                finalText = decodeAttributedBodyHeuristic(msg.attributedBody)
            }

            const from = msg.is_from_me ? 'ME' : msg.handle_id
            const date = macTimeToDate(msg.date).toLocaleString()
            const display = finalText || '(no text)'

            console.log(`[${date}] ${from}: ${display}`)
        }
    } catch (error) {
        console.error('Error:', error)
    } finally {
        db.close()
    }
}

main()
