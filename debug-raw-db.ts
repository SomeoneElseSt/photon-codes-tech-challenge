import Database from 'better-sqlite3'
import { homedir } from 'os'

function main() {
    const dbPath = `${homedir()}/Library/Messages/chat.db`
    console.log('Opening database:', dbPath)
    console.log('')

    const db = new Database(dbPath, { readonly: true })

    console.log('=== Last 10 Messages (Raw) ===')
    const raw = db.prepare(`
      SELECT
        ROWID,
        guid,
        text,
        attributedBody,
        is_from_me,
        date,
        handle_id
      FROM message
      ORDER BY date DESC
      LIMIT 10
    `).all()

    console.log(JSON.stringify(raw, null, 2))

    console.log('\n=== Checking for non-null text ===')
    const withText = db.prepare(`
      SELECT
        ROWID,
        guid,
        text,
        is_from_me,
        date
      FROM message
      WHERE text IS NOT NULL
      ORDER BY date DESC
      LIMIT 10
    `).all()

    console.log(JSON.stringify(withText, null, 2))

    db.close()
}

main()
