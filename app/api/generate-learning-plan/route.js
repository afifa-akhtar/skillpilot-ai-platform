import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createApiClient } from '@/lib/supabaseApi'
import { generateLearningPlanPrompt } from '@/lib/prompts'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
})

export async function POST(req) {
  try {
    const body = await req.json()
    const { goals, hoursPerWeek, months, isProjectRelated, projectName, techStacks } = body

    // Get user session - try multiple methods
    let user = null
    let authError = null
    let supabase = null
    
    // Method 1: Try with Authorization header (Bearer token)
    const authHeader = req.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
      supabase = createSupabaseClient(
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
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
      if (tokenUser) {
        user = tokenUser
      } else {
        authError = tokenError
      }
    }
    
    // Method 2: Try with cookies (if token method didn't work)
    if (!user) {
      supabase = createApiClient(req)
      const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser()
      if (cookieUser) {
        user = cookieUser
      } else {
        authError = cookieError || authError
      }
    }

    if (!user || !supabase) {
      console.error('Auth error:', authError)
      console.error('Cookie header present:', !!req.headers.get('cookie'))
      console.error('Auth header present:', !!authHeader)
      return NextResponse.json({ 
        error: 'Unauthorized',
        message: 'Please log in to generate a learning plan. Make sure you are logged in.',
        details: authError?.message 
      }, { status: 401 })
    }

    // Get user profile for context (profile might not exist yet)
    const { data: profile, error: profileError } = await supabase
      .from('learner_profiles')
      .select(`
        *,
        learner_tech_stacks (
          tech_stack_id,
          proficiency,
          years_of_experience,
          tech_stacks (
            id,
            name
          )
        )
      `)
      .eq('user_id', user.id)
      .single()
    
    // Profile error is OK - user might not have completed profile yet
    if (profileError && profileError.code !== 'PGRST116') {
      console.warn('Profile fetch warning:', profileError)
    }

    const userContext = {
      role: profile?.role_designation || 'Software Engineer',
      totalExperience: profile?.total_experience || 0,
      strengths: profile?.strengths || '',
      improvementAreas: profile?.improvement_areas || ''
    }

    // Get tech stack names with proficiency levels
    let techStacksWithProficiency = []
    if (techStacks && techStacks.length > 0) {
      const { data: techStackData, error: techStackError } = await supabase
        .from('tech_stacks')
        .select('id, name')
        .in('id', techStacks)

      if (techStackError) {
        console.warn('Tech stack fetch error:', techStackError)
      } else {
        // Match selected tech stacks with learner's proficiency from profile
        techStacksWithProficiency = techStackData?.map(ts => {
          // Find proficiency from learner's profile
          const learnerTechStack = profile?.learner_tech_stacks?.find(
            lts => lts.tech_stacks?.id === ts.id
          )
          
          return {
            name: ts.name,
            proficiency: learnerTechStack?.proficiency || 'Beginner',
            yearsOfExperience: learnerTechStack?.years_of_experience || 0
          }
        }) || []
      }
    }

    const prompt = generateLearningPlanPrompt({
      goals,
      hoursPerWeek,
      months,
      isProjectRelated,
      projectName: projectName || '',
      techStacks: techStacksWithProficiency,
      ...userContext
    })

    console.log('Calling OpenAI API...')
    console.log('Base URL:', process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1')
    console.log('API Key exists:', !!process.env.OPENAI_API_KEY)
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert learning and development consultant. Generate structured, actionable learning plans in a clear, organized format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    }).catch(error => {
      console.error('OpenAI API Error:', error)
      throw new Error(`OpenAI API Error: ${error.message || 'Failed to generate learning plan'}`)
    })

    const generatedPlan = completion.choices[0]?.message?.content || ''

    return NextResponse.json({
      success: true,
      plan: generatedPlan
    })
  } catch (error) {
    console.error('Error generating learning plan:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    })
    
    // Provide more detailed error message
    let errorMessage = 'Failed to generate learning plan'
    if (error.message) {
      errorMessage = error.message
    } else if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message
    } else if (error.cause?.message) {
      errorMessage = error.cause.message
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

