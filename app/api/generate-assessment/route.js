import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createApiClient } from '@/lib/supabaseApi'
import { generateAssessmentPrompt, generateFinalQuizPrompt } from '@/lib/prompts'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
})

export async function POST(req) {
  try {
    const body = await req.json()
    const { learningItemId, learningPlanId, assessmentType } = body

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
      return NextResponse.json({ 
        error: 'Unauthorized',
        message: 'Please log in',
        details: authError?.message 
      }, { status: 401 })
    }

    let prompt
    let assessmentData

    if (assessmentType === 'final_quiz') {
      // Get learning plan and completed items
      const { data: learningPlan, error: planError } = await supabase
        .from('learning_plans')
        .select('*')
        .eq('id', learningPlanId)
        .single()

      if (planError || !learningPlan) {
        return NextResponse.json({ error: 'Learning plan not found' }, { status: 404 })
      }

      const { data: completedItems } = await supabase
        .from('learning_items')
        .select('*')
        .eq('learning_plan_id', learningPlanId)
        .eq('status', 'completed')

      prompt = generateFinalQuizPrompt(learningPlan, completedItems || [])
      assessmentData = { learning_plan_id: learningPlanId }
    } else {
      // Get learning item with tech stacks
      const { data: learningItem, error: itemError } = await supabase
        .from('learning_items')
        .select(`
          *,
          learning_plans (
            learner_id,
            tech_stacks
          )
        `)
        .eq('id', learningItemId)
        .single()

      if (itemError || !learningItem) {
        return NextResponse.json({ error: 'Learning item not found' }, { status: 404 })
      }

      if (learningItem.learning_plans.learner_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      // Get user profile for tech stack proficiency
      const { data: profile } = await supabase
        .from('learner_profiles')
        .select(`
          learner_tech_stacks (
            tech_stack_id,
            proficiency,
            tech_stacks (id)
          )
        `)
        .eq('user_id', user.id)
        .single()

      // Get proficiency for the tech stack
      let techStackProficiency = 'Beginner'
      if (learningItem.learning_plans?.tech_stacks && profile?.learner_tech_stacks) {
        const planTechStacks = Array.isArray(learningItem.learning_plans.tech_stacks) 
          ? learningItem.learning_plans.tech_stacks 
          : []
        
        const proficiencies = profile.learner_tech_stacks
          .filter(lts => planTechStacks.includes(lts.tech_stacks?.id))
          .map(lts => lts.proficiency)
        
        if (proficiencies.length > 0) {
          if (proficiencies.includes('Expert')) {
            techStackProficiency = 'Expert'
          } else if (proficiencies.includes('Advanced')) {
            techStackProficiency = 'Advanced'
          } else if (proficiencies.includes('Intermediate')) {
            techStackProficiency = 'Intermediate'
          }
        }
      }

      prompt = generateAssessmentPrompt(learningItem, learningItem.content || '', {
        techStackProficiency
      })
      assessmentData = { learning_item_id: learningItemId }
    }

    console.log('Calling OpenAI API for assessment generation...')
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert assessment creator. Always return valid JSON with the assessment structure.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    }).catch(error => {
      console.error('OpenAI API Error:', error)
      throw new Error(`OpenAI API Error: ${error.message || 'Failed to generate assessment'}`)
    })

    const responseText = completion.choices[0]?.message?.content || '{}'
    let questions

    try {
      const parsed = JSON.parse(responseText)
      questions = parsed.questions || parsed
      
      // Validate and fix questions structure - FORCE ALL TO BE MULTIPLE CHOICE
      if (Array.isArray(questions)) {
        questions = questions.map((q, index) => {
          // Convert any question type to multiple choice
          let options = []
          let correctAnswer = q.correctAnswer || ''
          
          // If it's already multiple choice with options, use those
          if (q.type === 'multiple_choice' && q.options && Array.isArray(q.options) && q.options.length >= 2) {
            options = q.options
          } 
          // If it's true/false, convert to MCQ with True/False options
          else if (q.type === 'true_false' || (!q.options && (q.correctAnswer === 'True' || q.correctAnswer === 'False'))) {
            options = ['True', 'False']
            correctAnswer = q.correctAnswer || 'True'
          }
          // If it has options but wrong type, use those options
          else if (q.options && Array.isArray(q.options) && q.options.length >= 2) {
            options = q.options
          }
          // Default: create 4 options
          else {
            options = ['Option A', 'Option B', 'Option C', 'Option D']
            correctAnswer = options[0]
          }
          
          // Ensure exactly 4 options
          if (options.length !== 4) {
            while (options.length < 4) {
              options.push(`Option ${String.fromCharCode(68 + options.length)}`)
            }
            options = options.slice(0, 4)
          }
          
          // Ensure correctAnswer is in options
          if (!options.includes(correctAnswer)) {
            correctAnswer = options[0]
          }
          
          return {
            type: 'multiple_choice',
            question: q.question || `Question ${index + 1}`,
            options: options,
            correctAnswer: correctAnswer,
            explanation: q.explanation || 'No explanation provided'
          }
        })
      }
    } catch (e) {
      console.error('JSON parse error:', e)
      console.error('Response text:', responseText.substring(0, 500))
      // Fallback: try to extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/```\n([\s\S]*?)\n```/)
      if (jsonMatch) {
        try {
          questions = JSON.parse(jsonMatch[1]).questions || JSON.parse(jsonMatch[1])
        } catch (parseError) {
          console.error('Fallback parse error:', parseError)
          throw new Error('Invalid JSON response from AI. Please try again.')
        }
      } else {
        throw new Error('Invalid JSON response from AI. Please try again.')
      }
    }
    
    // Final validation
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('No questions generated. Please try again.')
    }

    // Create assessment record
    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .insert({
        ...assessmentData,
        assessment_type: assessmentType || 'learning_item',
        questions,
        learner_id: user.id
      })
      .select()
      .single()

    if (assessmentError) throw assessmentError

    return NextResponse.json({
      success: true,
      assessment: {
        id: assessment.id,
        questions
      }
    })
  } catch (error) {
    console.error('Error generating assessment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate assessment' },
      { status: 500 }
    )
  }
}

