import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createApiClient } from '@/lib/supabaseApi'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
})

export async function POST(req) {
  try {
    const body = await req.json()
    const { currentPlan, improvementRequest } = body

    // Get user session - try multiple methods
    let user = null
    let authError = null
    
    // Method 1: Try with Authorization header (Bearer token)
    const authHeader = req.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
      const tempClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        }
      )
      const { data: { user: tokenUser }, error: tokenError } = await tempClient.auth.getUser(token)
      if (tokenUser) {
        user = tokenUser
      } else {
        authError = tokenError
      }
    }
    
    // Method 2: Try with cookies (if token method didn't work)
    if (!user) {
      const supabase = createApiClient(req)
      const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser()
      if (cookieUser) {
        user = cookieUser
      } else {
        authError = cookieError || authError
      }
    }

    if (!user) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        message: 'Please log in',
        details: authError?.message 
      }, { status: 401 })
    }

    const prompt = `You are helping improve a learning plan. Here is the current plan:

${currentPlan}

The user wants to make the following improvements or adjustments:

${improvementRequest}

Please provide an improved version of the learning plan that incorporates these changes while maintaining the overall structure and learning objectives.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert learning and development consultant. Help improve learning plans based on user feedback.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })

    const improvedPlan = completion.choices[0]?.message?.content || ''

    return NextResponse.json({
      success: true,
      improvedPlan
    })
  } catch (error) {
    console.error('Error improving plan:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to improve plan' },
      { status: 500 }
    )
  }
}

