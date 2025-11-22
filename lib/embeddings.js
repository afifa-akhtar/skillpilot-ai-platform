// Utility for generating embeddings using OpenAI
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
})

/**
 * Generate embeddings for learning plan text
 * @param {string} text - The text to generate embeddings for
 * @returns {Promise<number[]>} - The embedding vector
 */
export async function generateEmbedding(text) {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for embedding generation')
    }

    // Truncate text if too long (OpenAI has a limit)
    const truncatedText = text.substring(0, 8000)

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small', // Using small model for cost efficiency
      input: truncatedText,
    })

    if (!response.data || response.data.length === 0) {
      throw new Error('No embedding data returned')
    }

    return response.data[0].embedding
  } catch (error) {
    console.error('Error generating embedding:', error)
    throw new Error(`Failed to generate embedding: ${error.message}`)
  }
}

/**
 * Generate embeddings for learning plan with metadata
 * @param {object} learningPlanData - The learning plan data
 * @returns {Promise<object>} - Object with embedding and metadata
 */
export async function generateLearningPlanEmbedding(learningPlanData) {
  try {
    // Create a comprehensive text representation of the learning plan
    const planText = `
Learning Goals: ${learningPlanData.goals}
Duration: ${learningPlanData.months} months
Hours per week: ${learningPlanData.hoursPerWeek} hours
Total hours: ${learningPlanData.months * 4 * learningPlanData.hoursPerWeek} hours
Project Related: ${learningPlanData.isProjectRelated ? `Yes - ${learningPlanData.projectName}` : 'No'}
Tech Stacks: ${learningPlanData.techStacks?.join(', ') || 'Not specified'}

Learning Plan Content:
${learningPlanData.generatedPlan || learningPlanData.adjustedPlan || ''}
    `.trim()

    const embedding = await generateEmbedding(planText)

    return {
      embedding,
      metadata: {
        goals: learningPlanData.goals,
        months: learningPlanData.months,
        hoursPerWeek: learningPlanData.hoursPerWeek,
        techStacks: learningPlanData.techStacks,
        isProjectRelated: learningPlanData.isProjectRelated,
        projectName: learningPlanData.projectName,
        totalHours: learningPlanData.months * 4 * learningPlanData.hoursPerWeek
      }
    }
  } catch (error) {
    console.error('Error generating learning plan embedding:', error)
    throw error
  }
}

