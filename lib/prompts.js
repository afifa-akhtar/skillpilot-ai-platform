// AI Prompts for generating learning content

export const generateLearningPlanPrompt = (userInput) => {
  return `You are an expert learning and development consultant for software engineering teams. 
Generate a comprehensive, structured learning plan based on the following requirements:

Learning Goals/Objectives: ${userInput.goals}
Hours per week: ${userInput.hoursPerWeek}
Duration: ${userInput.months} months
Related to existing project: ${userInput.isProjectRelated ? `Yes - ${userInput.projectName}` : 'No'}

Tech Stacks and Learner Proficiency:
${Array.isArray(userInput.techStacks) && userInput.techStacks.length > 0
  ? userInput.techStacks.map(ts => {
      if (typeof ts === 'object' && ts.proficiency) {
        return `- ${ts.name}: ${ts.proficiency} level (${ts.yearsOfExperience || 0} years of experience)`
      }
      return `- ${ts}: Proficiency level not specified (assume Beginner)`
    }).join('\n')
  : 'No tech stacks specified'}

User Profile Context:
- Role: ${userInput.role || 'Software Engineer'}
- Total Experience: ${userInput.totalExperience || 'Not specified'} years
- Strengths: ${userInput.strengths || 'Not specified'}
- Improvement Areas: ${userInput.improvementAreas || 'Not specified'}

IMPORTANT TIME CONSTRAINTS:
- Total duration: ${userInput.months} months
- Hours per week: ${userInput.hoursPerWeek} hours
- Total available hours: ${userInput.months * 4 * userInput.hoursPerWeek} hours (${userInput.months} months × 4 weeks × ${userInput.hoursPerWeek} hours/week)
- Average hours per module: ${Math.round((userInput.months * 4 * userInput.hoursPerWeek) / Math.ceil(userInput.months * 4))} hours

Create a learning plan with the following structure:
1. Break down the learning into approximately ${Math.ceil(userInput.months * 4)} modules (one per week)
2. Each module should be a learning item with:
   - Clear title (e.g., "Module 1: [Title]" or "Week 1: [Title]")
   - Learning objectives (specific, measurable goals)
   - Estimated time to complete (must fit within ${userInput.hoursPerWeek} hours per week, typically ${Math.round((userInput.months * 4 * userInput.hoursPerWeek) / Math.ceil(userInput.months * 4))} hours per module)
   - Prerequisites (if any)
   - Practical exercises or projects

3. CRITICAL - Respect Learner's Proficiency Levels:
   ${Array.isArray(userInput.techStacks) && userInput.techStacks.some(ts => typeof ts === 'object' && ts.proficiency)
     ? `- For tech stacks where the learner is "Advanced" or "Expert": DO NOT include beginner-level content. Focus on advanced topics, best practices, optimization, architecture, and real-world complex scenarios.
   - For tech stacks where the learner is "Intermediate": Include intermediate to advanced topics, skip basic fundamentals.
   - For tech stacks where the learner is "Beginner": Start from basics and build up progressively.
   - Match the difficulty level of each module to the learner's proficiency in the relevant tech stack(s).`
     : '- Assume beginner level for all tech stacks if proficiency is not specified.'}

4. Ensure the plan is:
   - Progressive (builds on previous knowledge, but respects existing proficiency)
   - Practical and hands-on
   - Aligned with the user's goals and current skill level in EACH tech stack
   - Realistic for the time allocation (${userInput.hoursPerWeek} hours/week, ${userInput.months} months total)
   - Each module's estimated time should NOT exceed ${userInput.hoursPerWeek} hours
   - Total estimated time across all modules should be approximately ${userInput.months * 4 * userInput.hoursPerWeek} hours
   - Content difficulty should match the learner's proficiency level in each tech stack

4. Format each module EXACTLY as follows (this format is CRITICAL for parsing):

**Module 1: [Clear, Descriptive Title]**

Objectives: [Specific learning objectives - what the learner will achieve]

Estimated Time: [X] hours

Prerequisites: [List any prerequisites or "None" if none]

[Optional: Brief description or additional context for this module]

**Module 2: [Clear, Descriptive Title]**

Objectives: [Specific learning objectives]

Estimated Time: [X] hours

Prerequisites: [Prerequisites or "None"]

[Description]

...continue for all modules...

CRITICAL FORMATTING RULES:
- Start each module with "**Module X:**" (with asterisks) followed by the title on the same line
- Use "Objectives:" on its own line, followed by the objectives on the next line(s)
- Use "Estimated Time:" on its own line, followed by "[X] hours" on the next line
- Use "Prerequisites:" on its own line, followed by prerequisites or "None" on the next line
- Leave a blank line between modules for clear separation
- Use clear, descriptive titles (NOT generic like "Learning Objectives" or just numbers)
- Make objectives specific and actionable
- DO NOT create more modules than the duration allows (approximately ${Math.ceil(userInput.months * 4)} modules for ${userInput.months} months)

Return ONLY the modules in the exact format above. Do not add extra text before or after the modules.`
}

export const generateLearningContentPrompt = (learningItem, userContext) => {
  const proficiency = userContext.techStackProficiency || 'Beginner'
  
  return `You are an expert instructor creating learning content for software engineers.

Learning Item: ${learningItem.title}
Learning Objectives: ${learningItem.objectives || 'Not specified'}
Tech Stack: ${learningItem.techStack || 'Not specified'}

User Context:
- Overall Experience Level: ${userContext.experienceLevel || 'Intermediate'}
- Tech Stack Proficiency: ${proficiency}
- Strengths: ${userContext.strengths || 'Not specified'}

CRITICAL INSTRUCTIONS BASED ON PROFICIENCY LEVEL:
${proficiency === 'Expert' || proficiency === 'Advanced' 
  ? `- DO NOT include basic concepts, syntax explanations, or beginner tutorials
- Focus on advanced patterns, architecture, optimization, scalability, and enterprise-level practices
- Assume the learner already knows fundamentals
- Include complex real-world scenarios, edge cases, and performance considerations
- Cover advanced topics like design patterns, system design, and best practices for production systems`
  : proficiency === 'Intermediate'
  ? `- Skip basic syntax and fundamentals
- Focus on intermediate to advanced concepts
- Include practical examples and real-world applications
- Cover best practices and common patterns
- Assume basic knowledge but explain intermediate concepts clearly`
  : `- Start with fundamentals if needed
- Build up from basics progressively
- Include clear explanations of core concepts
- Provide practical examples suitable for beginners`}

Create comprehensive learning content that includes:
1. Introduction and overview (appropriate for ${proficiency} level)
2. Core concepts explained clearly (skip basics if ${proficiency === 'Advanced' || proficiency === 'Expert' ? 'Advanced/Expert' : proficiency})
3. Practical examples and code snippets (complexity matching ${proficiency} level)
4. Best practices and advanced patterns
5. Common pitfalls to avoid
6. Real-world applications and use cases

IMPORTANT FORMATTING REQUIREMENTS:
- Include relevant links to official documentation, GitHub repositories, tutorials, and resources
- Format links clearly with full URLs (e.g., https://github.com/example/repo, https://docs.example.com)
- Include GitHub links for code examples, libraries, or related projects when relevant
- CRITICAL: Include YouTube video links for visual learning (format: https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID)
- CRITICAL: Include Udemy course links when relevant (format: https://www.udemy.com/course/COURSE_NAME/)
- Use clear headings (## for main sections, ### for subsections)
- Use markdown formatting for code blocks, bold text, and lists
- Make the content engaging, practical, and suitable for ${proficiency} proficiency level
- Match the complexity and depth to the learner's skill level

Example link format:
- Official Documentation: https://docs.example.com
- GitHub Repository: https://github.com/example/repo
- YouTube Video: https://www.youtube.com/watch?v=VIDEO_ID
- Udemy Course: https://www.udemy.com/course/example-course/
- Tutorial: https://example.com/tutorial

When including YouTube or Udemy links, place them in dedicated sections like:
## Video Resources
- [Video Title](https://www.youtube.com/watch?v=VIDEO_ID)
- [Course Name](https://www.udemy.com/course/example-course/)`
}

export const generateAssessmentPrompt = (learningItem, content, userContext = {}) => {
  const proficiency = userContext.techStackProficiency || 'Beginner'
  
  return `You are an expert assessment creator for software engineering education.

Learning Item: ${learningItem.title}
Learning Objectives: ${learningItem.objectives || 'Not specified'}
Learning Content: ${content.substring(0, 2000)}...
Learner Proficiency Level: ${proficiency}

CRITICAL REQUIREMENTS:
1. Create ONLY Multiple Choice Questions (MCQs) - NO true/false, NO short answer, NO text input questions
2. Generate 5-10 questions that are SPECIFICALLY related to this module: "${learningItem.title}"
3. Questions must test understanding of concepts covered in this specific module only
4. Each question must have exactly 4 options (A, B, C, D) with only ONE correct answer
5. Include clear explanations for each answer
6. Questions should test understanding, not just memorization
7. Difficulty should match the ${proficiency} proficiency level:
   ${proficiency === 'Expert' || proficiency === 'Advanced'
     ? `- NO basic syntax or fundamental questions
   - Focus on advanced concepts, architecture, optimization, and complex scenarios
   - Questions should test deep understanding and practical application
   - Include questions about best practices, design patterns, and system design`
     : proficiency === 'Intermediate'
     ? `- Skip basic syntax questions
   - Focus on intermediate concepts and practical application
   - Include questions about patterns, best practices, and real-world scenarios`
     : `- Can include fundamental concepts
   - Test understanding of core concepts and basic application
   - Questions should be clear and help reinforce learning`}

Return the assessment in JSON format with this EXACT structure:
{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "question text",
      "options": ["option1", "option2", "option3", "option4"],
      "correctAnswer": "option1",
      "explanation": "explanation of why this is correct"
    }
  ]
}

IMPORTANT: 
- For multiple_choice questions, ALWAYS provide exactly 4 options in the "options" array
- For true_false questions, use type "true_false" and options will be ["True", "False"]
- Always include the "explanation" field for each question
- The "correctAnswer" must match one of the options exactly`
}

export const generateFinalQuizPrompt = (learningPlan, completedItems) => {
  const totalHours = learningPlan.months * 4 * learningPlan.hours_per_week
  const techStacks = Array.isArray(learningPlan.tech_stacks) 
    ? learningPlan.tech_stacks.join(', ') 
    : (learningPlan.tech_stacks || 'Not specified')
  
  return `You are creating a comprehensive final assessment for a completed learning plan.

Learning Plan Details:
- Goals: ${learningPlan.goals}
- Duration: ${learningPlan.months} months
- Hours per week: ${learningPlan.hours_per_week} hours
- Total learning hours: ${totalHours} hours
- Tech Stacks: ${techStacks}
- Project Related: ${learningPlan.is_project_related ? `Yes - ${learningPlan.project_name || 'N/A'}` : 'No'}

Completed Learning Items (${completedItems.length} items):
${completedItems.map((item, idx) => `${idx + 1}. ${item.title}${item.objectives ? ` - ${item.objectives.substring(0, 100)}` : ''}`).join('\n')}

Create a comprehensive final quiz that:
1. Tests understanding across ALL completed learning items
2. Includes 15-20 questions (more if there are many learning items)
3. Covers both theoretical knowledge and practical application
4. Mix of question types (multiple choice, true/false, short answer)
5. Questions should be challenging but fair
6. Include correct answers and detailed explanations
7. Questions should reflect the learning plan's goals, tech stacks, and duration
8. Consider the total learning hours (${totalHours} hours) when determining question difficulty

Return the quiz in JSON format:
{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "question text",
      "options": ["option1", "option2", "option3", "option4"],
      "correctAnswer": "option1",
      "explanation": "explanation of why this is correct"
    }
  ]
}

IMPORTANT: 
- For multiple_choice questions, ALWAYS provide exactly 4 options
- For true_false questions, use type "true_false" and options will be ["True", "False"]
- Always include the "explanation" field for each question
- The "correctAnswer" must match one of the options exactly`
}

