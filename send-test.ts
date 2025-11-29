import { IMessageSDK } from '@photon-ai/imessage-kit'

async function main() {
    const sdk = new IMessageSDK()

    const myNumber = '+14155836520'  // Your number
    const testMessage = 'Test message from SDK ' + new Date().toLocaleTimeString()

    console.log('Sending test message to:', myNumber)
    console.log('Message:', testMessage)

    await sdk.send(myNumber, testMessage)

    console.log('Sent!')
    await sdk.close()
}

main()
