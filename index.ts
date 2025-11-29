import 'dotenv/config'
import { IMessageSDK, type Message } from '@photon-ai/imessage-kit'
import OpenAI from 'openai'

const USER_PHONE = process.env.USER_PHONE_NUMBER!
const AGENT_ID = process.env.AGENT_IMESSAGE_ID!
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

// Active coaching sessions
interface CoachingSession {
  targetContact: string
  coachingGoal: string
  conversationHistory: Message[]
}

const activeSessions = new Map<string, CoachingSession>()
const processedMessageIds = new Set<string>()

function parseActivationCommand(text: string): { contact: string; goal: string } | null {
  const match = text.match(/coach me on (.+?) - (.+)/i)
  if (!match) return null

  return {
    contact: match[1].trim(),
    goal: match[2].trim()
  }
}

// Coaching orchestrator
async function getCoaching(
  incomingMessage: string,
  conversationHistory: Message[],
  coachingGoal: string
): Promise<string> {
  const messages = [
    {
      role: 'system' as const,
      content: `You are a conversation coach helping the user with: ${coachingGoal}.

Analyze incoming messages and provide:
1. 2-3 succint suggested responses with brief justifications  
3. Advice and general tips as relevant

Be concise and actionable. Format suggestions clearly.`
    },
    // Add conversation context 
    ...conversationHistory.slice(-10).map(msg => ({
      role: 'user' as const,
      content: `${msg.isFromMe ? '[User sent]' : '[Contact sent]'}: ${msg.text || '[no text]'}`
    })),
    {
      role: 'user' as const,
      content: `They just said: "${incomingMessage}"\n\nProvide coaching now.`
    }
  ]

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.7,
    max_tokens: 500
  })

  return response.choices[0]?.message?.content || 'No coaching available'
}

async function handleIncomingMessage(sdk: IMessageSDK, msg: Message) {
  // Deduplicate
  if (processedMessageIds.has(msg.id)) return
  processedMessageIds.add(msg.id)

  if (msg.sender === USER_PHONE && msg.chatId.includes(AGENT_ID)) {
    const command = parseActivationCommand(msg.text || '')

	// Activates coachign
    if (command) {
      activeSessions.set(command.contact, {
        targetContact: command.contact,
        coachingGoal: command.goal,
        conversationHistory: []
      })

      await sdk.send(USER_PHONE,
        `Hi! Coaching activated for ${command.contact}\n\nContext: ${command.goal}\n\n Starting now 💬.`
      )
      return
    }

    return
  }

  // Check if message is from an active coaching target
  const session = activeSessions.get(msg.sender)
  if (!session) return

  session.conversationHistory.push(msg)

  const coaching = await getCoaching(
    msg.text || '',
    session.conversationHistory,
    session.coachingGoal
  )

  await sdk.send(USER_PHONE, `💬 ${msg.sender} said: "${msg.text}"\n\n${coaching}`)
}

// Add outgoing messages to context
function handleOutgoingMessage(msg: Message) {
  for (const session of activeSessions.values()) {
    if (msg.chatId.includes(session.targetContact) || msg.sender === session.targetContact) {
      // Add to conversation history silently
      session.conversationHistory.push(msg)
      break
    }
  }
}

// Main
async function main() {

  console.log("Starting backend.")
  console.log("User: ${USER_PHONE}")
  console.log("Agent ID: ${AGENT_ID}")
  
  const sdk = new IMessageSDK({
    maxConcurrent: 5,
    watcher: {
      pollInterval: 2000,
      unreadOnly: false,
      excludeOwnMessages: false  
    }
  })

  await sdk.startWatching({
    onNewMessage: async (msg: Message) => {
      if (msg.isFromMe) {
        // User's outgoing message - track for context
        handleOutgoingMessage(msg)
      } else {
        // Incoming message - potentially coach
        await handleIncomingMessage(sdk, msg)
      }
    },

    onError: (error) => {
      console.error('Watcher error:', error.message)
    }
  })

  console.log('Watching for messages🔭...')
  console.log(`\nTo activate: Message ${AGENT_ID} with "coach me on <the contact you need help with> - help me with X"`)

  // Shutdown
  process.on('SIGINT', async () => {
    console.log('\n⏹️  Stopping...')
    sdk.stopWatching()
    await sdk.close()
    process.exit(0)
  })
}

main().catch(console.error)
