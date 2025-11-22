// Quick test script for OpenAI API
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
})

async function test() {
  try {
    console.log('Testing OpenAI API...')
    console.log('Base URL:', process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1')
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: 'Say hello' }
      ],
      max_tokens: 10
    })
    
    console.log('✅ Success:', completion.choices[0]?.message?.content)
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error('Full error:', error)
  }
}

test()

