import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createApiClient } from '@/lib/supabaseApi'
import { generateLearningContentPrompt } from '@/lib/prompts'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
})

export async function POST(req) {
  try {
    const body = await req.json()
    const { learningItemId } = body

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
      return NextResponse.json({ 
        error: 'Unauthorized',
        message: 'Please log in to generate content',
        details: authError?.message 
      }, { status: 401 })
    }

    // Get learning item
    const { data: learningItem, error: itemError } = await supabase
      .from('learning_items')
      .select(`
        *,
        learning_plans (
          tech_stacks,
          learner_id
        )
      `)
      .eq('id', learningItemId)
      .single()

    if (itemError || !learningItem) {
      return NextResponse.json({ error: 'Learning item not found' }, { status: 404 })
    }

    // Check access
    if (learningItem.learning_plans.learner_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get user profile for context with tech stack proficiency
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

    // Get proficiency for the tech stack used in this learning item
    let techStackProficiency = 'Beginner'
    if (learningItem.learning_plans?.tech_stacks && profile?.learner_tech_stacks) {
      // Find matching tech stack proficiency
      const planTechStacks = Array.isArray(learningItem.learning_plans.tech_stacks) 
        ? learningItem.learning_plans.tech_stacks 
        : []
      
      // Get the highest proficiency level among selected tech stacks
      const proficiencies = profile.learner_tech_stacks
        .filter(lts => planTechStacks.includes(lts.tech_stack_id))
        .map(lts => lts.proficiency)
      
      if (proficiencies.length > 0) {
        // Priority: Expert > Advanced > Intermediate > Beginner
        if (proficiencies.includes('Expert')) {
          techStackProficiency = 'Expert'
        } else if (proficiencies.includes('Advanced')) {
          techStackProficiency = 'Advanced'
        } else if (proficiencies.includes('Intermediate')) {
          techStackProficiency = 'Intermediate'
        }
        // else remains 'Beginner'
      }
    }

    const userContext = {
      experienceLevel: profile?.total_experience > 5 ? 'Advanced' : profile?.total_experience > 2 ? 'Intermediate' : 'Beginner',
      strengths: profile?.strengths || '',
      techStackProficiency: techStackProficiency
    }

    const prompt = generateLearningContentPrompt(learningItem, userContext)

    console.log('Calling OpenAI API for content generation...')
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert instructor creating comprehensive, engaging learning content for software engineers.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 3000
    }).catch(error => {
      console.error('OpenAI API Error:', error)
      throw new Error(`OpenAI API Error: ${error.message || 'Failed to generate content'}`)
    })

    const content = completion.choices[0]?.message?.content || ''

    // Update learning item with content
    await supabase
      .from('learning_items')
      .update({ content })
      .eq('id', learningItemId)

    return NextResponse.json({
      success: true,
      content
    })
  } catch (error) {
    console.error('Error generating content:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    
    let errorMessage = 'Failed to generate content'
    if (error.message) {
      errorMessage = error.message
    } else if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message
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

