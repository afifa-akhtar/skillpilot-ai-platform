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
    const { text, learningPlanData } = body

    // Get user session
    let user = null
    const authHeader = req.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
      const supabase = createSupabaseClient(
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
      const { data: { user: tokenUser } } = await supabase.auth.getUser(token)
      if (tokenUser) {
        user = tokenUser
      }
    }
    
    if (!user) {
      const supabase = createApiClient(req)
      const { data: { user: cookieUser } } = await supabase.auth.getUser()
      if (cookieUser) {
        user = cookieUser
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Generate embedding
    let embeddingText = text
    if (learningPlanData) {
      // Handle tech stacks - could be array of strings or array of objects
      let techStacksText = 'Not specified'
      if (learningPlanData.techStacks && Array.isArray(learningPlanData.techStacks)) {
        if (learningPlanData.techStacks.length > 0) {
          if (typeof learningPlanData.techStacks[0] === 'string') {
            techStacksText = learningPlanData.techStacks.join(', ')
          } else if (typeof learningPlanData.techStacks[0] === 'object') {
            // Array of objects with techStackId or name
            techStacksText = learningPlanData.techStacks
              .map(ts => ts.techStackName || ts.name || ts.techStackId || ts)
              .filter(Boolean)
              .join(', ')
          }
        }
      }
      
      embeddingText = `
Learning Goals: ${learningPlanData.goals || 'Not specified'}
Duration: ${learningPlanData.months || 0} months
Hours per week: ${learningPlanData.hoursPerWeek || 0} hours
Total hours: ${(learningPlanData.months || 0) * 4 * (learningPlanData.hoursPerWeek || 0)} hours
Project Related: ${learningPlanData.isProjectRelated ? `Yes - ${learningPlanData.projectName || 'N/A'}` : 'No'}
Tech Stacks: ${techStacksText}

Learning Plan Content:
${learningPlanData.generatedPlan || learningPlanData.adjustedPlan || ''}
      `.trim()
    }

    if (!embeddingText || embeddingText.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    // Truncate if too long
    const truncatedText = embeddingText.substring(0, 8000)

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: truncatedText,
    })

    if (!response.data || response.data.length === 0) {
      return NextResponse.json({ error: 'No embedding data returned' }, { status: 500 })
    }

    const embedding = response.data[0].embedding

    return NextResponse.json({
      success: true,
      embedding,
      metadata: learningPlanData ? {
        goals: learningPlanData.goals || '',
        months: learningPlanData.months || 0,
        hoursPerWeek: learningPlanData.hoursPerWeek || 0,
        techStacks: Array.isArray(learningPlanData.techStacks) ? learningPlanData.techStacks : [],
        isProjectRelated: learningPlanData.isProjectRelated || false,
        projectName: learningPlanData.projectName || '',
        totalHours: (learningPlanData.months || 0) * 4 * (learningPlanData.hoursPerWeek || 0)
      } : null
    })
  } catch (error) {
    console.error('Error generating embedding:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate embedding' },
      { status: 500 }
    )
  }
}

