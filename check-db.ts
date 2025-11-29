import { IMessageSDK } from '@photon-ai/imessage-kit'
import { existsSync } from 'fs'
import { homedir } from 'os'

async function main() {
    const dbPath = `${homedir()}/Library/Messages/chat.db`

    console.log('Checking database access...')
    console.log('Database path:', dbPath)
    console.log('Exists?', existsSync(dbPath))
    console.log('')

    const sdk = new IMessageSDK()

    try {
        // Get recent messages
        console.log('Fetching last 100 messages...')
        const result = await sdk.getMessages({
            limit: 100,
            excludeOwnMessages: false
        })

        console.log('Total messages found:', result.total)
        console.log('Unread count:', result.unreadCount)
        console.log('')

        console.log('Recent messages:')
        for (const msg of result.messages) {
            console.log('---')
            console.log('From:', msg.sender)
            console.log('IsFromMe:', msg.isFromMe)
            console.log('Text:', msg.text)
            console.log('Date:', msg.date)
        }

        await sdk.close()
        console.log('\nDatabase access OK!')
    } catch (error) {
        console.error('Error accessing database:', error)
        await sdk.close()
    }
}

main()
