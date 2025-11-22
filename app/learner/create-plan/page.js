"use client"

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Loader2, MessageSquare, Send, BookOpen, Sparkles, ArrowLeft, LogOut, User as UserIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

function CreateLearningPlanPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [improving, setImproving] = useState(false)
  const [techStacks, setTechStacks] = useState([])
  const [userTechStacks, setUserTechStacks] = useState([])
  const [formData, setFormData] = useState({
    goals: '',
    hoursPerWeek: '',
    months: '',
    isProjectRelated: false,
    projectName: '',
    selectedTechStacks: []
  })
  const [generatedPlan, setGeneratedPlan] = useState('')
  const [adjustedPlan, setAdjustedPlan] = useState('')
  const [chatMessages, setChatMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [planId, setPlanId] = useState(null)
  const [hasActivePlan, setHasActivePlan] = useState(false)
  const [existingPlan, setExistingPlan] = useState(null)
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')

  useEffect(() => {
    loadUserInfo()
    checkActivePlan()
    loadTechStacks()
    loadUserTechStacks()
    
    // Load draft if draft ID is in query params
    const draftId = searchParams.get('draft')
    if (draftId) {
      loadDraftPlan(draftId)
    }
  }, [searchParams])

  const loadUserInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || '')
        // Try to get name from user metadata or email
        const name = user.user_metadata?.full_name || 
                     user.user_metadata?.name || 
                     user.email?.split('@')[0] || 
                     'User'
        setUserName(name)
      }
    } catch (error) {
      console.error('Error loading user info:', error)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const checkActivePlan = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check if user already has an active plan
      const { data: activePlan } = await supabase
        .from('learning_plans')
        .select('*')
        .eq('learner_id', user.id)
        .in('status', ['approved', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (activePlan) {
        setHasActivePlan(true)
        setExistingPlan(activePlan)
      }
    } catch (error) {
      // No active plan found
      setHasActivePlan(false)
    }
  }

  const loadTechStacks = async () => {
    try {
      const { data, error } = await supabase
        .from('tech_stacks')
        .select('*')
        .order('name')

      if (error) throw error
      setTechStacks(data || [])
    } catch (error) {
      console.error('Error loading tech stacks:', error)
    }
  }

  const loadUserTechStacks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('learner_profiles')
        .select(`
          learner_tech_stacks (
            tech_stack_id,
            tech_stacks (
              id,
              name
            )
          )
        `)
        .eq('user_id', user.id)
        .single()

      if (profile?.learner_tech_stacks) {
        const techStackIds = profile.learner_tech_stacks
          .map(lt => lt.tech_stacks)
          .filter(Boolean)
        setUserTechStacks(techStackIds)
      }
    } catch (error) {
      console.error('Error loading user tech stacks:', error)
    }
  }

  const loadDraftPlan = async (draftId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: draft, error } = await supabase
        .from('learning_plans')
        .select('*')
        .eq('id', draftId)
        .eq('learner_id', user.id)
        .eq('status', 'draft')
        .single()

      if (error) throw error

      if (draft) {
        // Populate form with draft data
        setFormData({
          goals: draft.goals || '',
          hoursPerWeek: draft.hours_per_week?.toString() || '',
          months: draft.months?.toString() || '',
          isProjectRelated: draft.is_project_related || false,
          projectName: draft.project_name || '',
          selectedTechStacks: draft.tech_stacks || []
        })

        // Load the generated/adjusted plan
        if (draft.adjusted_plan) {
          setAdjustedPlan(draft.adjusted_plan)
          setGeneratedPlan(draft.adjusted_plan)
        } else if (draft.generated_plan) {
          setAdjustedPlan(draft.generated_plan)
          setGeneratedPlan(draft.generated_plan)
        }

        // Set plan ID for updates
        setPlanId(draft.id)

        // Load chat messages if any
        if (draft.id) {
          const { data: messages } = await supabase
            .from('admin_chat_messages')
            .select(`
              *,
              users (
                role
              )
            `)
            .eq('learning_plan_id', draft.id)
            .order('created_at', { ascending: true })

          if (messages) {
            setChatMessages(messages)
          }
        }

        toast.success('Draft plan loaded')
      }
    } catch (error) {
      console.error('Error loading draft plan:', error)
      toast.error('Failed to load draft plan')
    }
  }

  const handleGeneratePlan = async () => {
    if (!formData.goals || !formData.hoursPerWeek || !formData.months || formData.selectedTechStacks.length === 0) {
      toast.error('Please fill in all required fields')
      return
    }

    setGenerating(true)

    try {
      // Get current session to include auth token
      const { data: { session } } = await supabase.auth.getSession()
      
      const headers = {
        'Content-Type': 'application/json'
      }
      
      // Add auth token if available
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch('/api/generate-learning-plan', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          goals: formData.goals,
          hoursPerWeek: parseInt(formData.hoursPerWeek),
          months: parseInt(formData.months),
          isProjectRelated: formData.isProjectRelated,
          projectName: formData.projectName,
          techStacks: formData.selectedTechStacks
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate learning plan')
      }

      setGeneratedPlan(data.plan)
      setAdjustedPlan(data.plan)
      
      // Check if plan already exists (for editing)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: existingPlan } = await supabase
          .from('learning_plans')
          .select('id')
          .eq('learner_id', user.id)
          .eq('status', 'draft')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        
        if (existingPlan) {
          setPlanId(existingPlan.id)
          loadChatMessages()
        }
      }
      
      toast.success('Learning plan generated successfully!')
    } catch (error) {
      console.error('Error generating plan:', error)
      toast.error(error.message || 'Failed to generate learning plan')
    } finally {
      setGenerating(false)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return
    if (!adjustedPlan && !generatedPlan) {
      toast.error('Please generate a learning plan first')
      return
    }

    const messageText = newMessage.trim()
    setNewMessage('')
    setImproving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Please log in')
        return
      }

      // Create or update plan if it doesn't exist yet
      let currentPlanId = planId
      if (!currentPlanId) {
        // Create a draft plan to enable chat
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (!currentUser) {
          toast.error('Please log in')
          return
        }

        const techStackIds = formData.selectedTechStacks.map(ts => 
          typeof ts === 'object' ? ts.techStackId : ts
        )

        const { data: draftPlan, error: draftError } = await supabase
          .from('learning_plans')
          .insert({
            learner_id: currentUser.id,
            goals: formData.goals,
            hours_per_week: parseInt(formData.hoursPerWeek),
            months: parseInt(formData.months),
            is_project_related: formData.isProjectRelated,
            project_name: formData.projectName || null,
            tech_stacks: techStackIds,
            generated_plan: adjustedPlan || generatedPlan,
            adjusted_plan: adjustedPlan || generatedPlan,
            status: 'draft'
          })
          .select()
          .single()

        if (draftError) {
          console.error('Error creating draft plan:', draftError)
        } else {
          currentPlanId = draftPlan.id
          setPlanId(draftPlan.id)
        }
      }

      // Add message to chat
      if (currentPlanId) {
        const { error: chatError } = await supabase
          .from('admin_chat_messages')
          .insert({
            learning_plan_id: currentPlanId,
            sender_id: user.id,
            message: messageText
          })

        if (chatError) {
          console.error('Error saving chat message:', chatError)
        }
      }

      // Improve the plan based on the message
      const { data: { session } } = await supabase.auth.getSession()
      const headers = {
        'Content-Type': 'application/json'
      }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const currentPlan = adjustedPlan || generatedPlan
      const response = await fetch('/api/improve-plan', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          currentPlan: currentPlan,
          improvementRequest: messageText
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to improve plan')
      }

      // Update the plan
      setAdjustedPlan(data.improvedPlan)
      setGeneratedPlan(data.improvedPlan)
      
      // Update plan in database if it exists
      if (currentPlanId) {
        await supabase
          .from('learning_plans')
          .update({
            adjusted_plan: data.improvedPlan,
            generated_plan: data.improvedPlan
          })
          .eq('id', currentPlanId)

        // Add AI response to chat
        // Note: We'll identify AI messages by checking if message starts with "Learning plan has been updated"
        const aiMessage = `Learning plan has been updated based on your feedback.`
        // For now, we'll still save with user.id but mark it differently in the UI
        // In a production system, you'd want to add an is_ai boolean field to the schema
        await supabase
          .from('admin_chat_messages')
          .insert({
            learning_plan_id: currentPlanId,
            sender_id: user.id,
            message: `[AI] ${aiMessage}` // Prefix to identify AI messages
          })
      }

      // Reload chat messages to get updated list
      if (planId) {
        loadChatMessages()
      } else {
        // Add messages to local state for display if plan not saved yet
        setChatMessages(prev => [
          ...prev,
          { message: messageText, sender: 'user', created_at: new Date().toISOString() },
          { message: 'Learning plan has been updated based on your feedback.', sender: 'ai', created_at: new Date().toISOString() }
        ])
      }

      toast.success('Plan improved successfully!')
    } catch (error) {
      console.error('Error improving plan:', error)
      toast.error(error.message || 'Failed to improve plan')
      setNewMessage(messageText) // Restore message on error
    } finally {
      setImproving(false)
    }
  }

  const loadChatMessages = async () => {
    if (!planId) return
    
    try {
      const { data, error } = await supabase
        .from('admin_chat_messages')
        .select(`
          *,
          users!admin_chat_messages_sender_id_fkey (
            email,
            role
          )
        `)
        .eq('learning_plan_id', planId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setChatMessages(data || [])
    } catch (error) {
      console.error('Error loading chat messages:', error)
    }
  }

  useEffect(() => {
    if (planId) {
      loadChatMessages()
      // Poll for new messages every 3 seconds
      const interval = setInterval(loadChatMessages, 3000)
      return () => clearInterval(interval)
    }
  }, [planId])

  const handleSubmit = async () => {
    if (!adjustedPlan) {
      toast.error('Please generate a learning plan first')
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Please log in')
        router.push('/learner/login')
        return
      }

      // Parse learning plan to extract modules
      const modules = parseLearningPlan(adjustedPlan)
      console.log('Parsed modules for submission:', modules)

      // Generate embedding for the learning plan via API
      let embedding = null
      let embeddingMetadata = null
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const headers = {
          'Content-Type': 'application/json'
        }
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }

        // Get tech stack names for embedding
        const techStackIds = formData.selectedTechStacks.map(ts => 
          typeof ts === 'object' ? ts.techStackId : ts
        )
        const { data: techStackData } = await supabase
          .from('tech_stacks')
          .select('id, name')
          .in('id', techStackIds)

        const techStackNames = techStackData?.map(ts => ts.name) || []

        const embeddingResponse = await fetch('/api/generate-embedding', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            learningPlanData: {
              goals: formData.goals,
              months: parseInt(formData.months),
              hoursPerWeek: parseInt(formData.hoursPerWeek),
              techStacks: techStackNames, // Use names instead of objects
              isProjectRelated: formData.isProjectRelated,
              projectName: formData.projectName || '',
              generatedPlan: generatedPlan,
              adjustedPlan: adjustedPlan
            }
          })
        })

        if (embeddingResponse.ok) {
          const embeddingData = await embeddingResponse.json()
          if (embeddingData.success && embeddingData.embedding) {
            embedding = embeddingData.embedding
            embeddingMetadata = embeddingData.metadata
            console.log('Embedding generated successfully')
          } else {
            console.warn('Embedding response missing data')
          }
        } else {
          const errorData = await embeddingResponse.json().catch(() => ({}))
          console.warn('Failed to generate embedding:', errorData.error || embeddingResponse.statusText)
        }
      } catch (embeddingError) {
        console.warn('Failed to generate embedding, continuing without it:', embeddingError)
        // Continue without embedding - it's not critical for basic functionality
      }

      // Prepare tech stacks for database (store as array of IDs)
      const techStackIds = formData.selectedTechStacks.map(ts => 
        typeof ts === 'object' ? ts.techStackId : ts
      )

      let learningPlan

      // If planId exists, update the existing draft plan; otherwise create a new one
      if (planId) {
        // Update existing draft plan
        const planUpdateData = {
          goals: formData.goals,
          hours_per_week: parseInt(formData.hoursPerWeek),
          months: parseInt(formData.months),
          is_project_related: formData.isProjectRelated,
          project_name: formData.projectName || null,
          tech_stacks: techStackIds,
          generated_plan: generatedPlan,
          adjusted_plan: adjustedPlan,
          status: 'pending_approval' // Change status from draft to pending_approval
        }

        // Only add embedding fields if they exist (PostgreSQL JSONB)
        if (embedding && Array.isArray(embedding)) {
          planUpdateData.embedding = embedding
        }
        if (embeddingMetadata && typeof embeddingMetadata === 'object') {
          planUpdateData.embedding_metadata = embeddingMetadata
        }

        console.log('Updating draft plan:', { planId, planUpdateData })
        
        const { data: updatedPlan, error: updateError } = await supabase
          .from('learning_plans')
          .update(planUpdateData)
          .eq('id', planId)
          .eq('learner_id', user.id) // Ensure user owns this plan
          .select()
          .single()

        if (updateError) {
          console.error('Error updating learning plan:', updateError)
          console.error('Update error details:', JSON.stringify(updateError, null, 2))
          throw updateError
        }

        if (!updatedPlan) {
          console.error('Update returned no data')
          throw new Error('Failed to update learning plan - no data returned')
        }

        console.log('Plan updated successfully:', { id: updatedPlan.id, status: updatedPlan.status })
        learningPlan = updatedPlan

        // Delete existing learning items for this plan before creating new ones
        await supabase
          .from('learning_items')
          .delete()
          .eq('learning_plan_id', planId)
      } else {
        // Create new learning plan
        const planInsertData = {
          learner_id: user.id,
          goals: formData.goals,
          hours_per_week: parseInt(formData.hoursPerWeek),
          months: parseInt(formData.months),
          is_project_related: formData.isProjectRelated,
          project_name: formData.projectName || null,
          tech_stacks: techStackIds,
          generated_plan: generatedPlan,
          adjusted_plan: adjustedPlan,
          status: 'pending_approval'
        }

        // Only add embedding fields if they exist (PostgreSQL JSONB)
        if (embedding && Array.isArray(embedding)) {
          planInsertData.embedding = embedding
        }
        if (embeddingMetadata && typeof embeddingMetadata === 'object') {
          planInsertData.embedding_metadata = embeddingMetadata
        }

        const { data: newPlan, error: planError } = await supabase
          .from('learning_plans')
          .insert(planInsertData)
          .select()
          .single()

        if (planError) {
          console.error('Error creating learning plan:', planError)
          throw planError
        }

        learningPlan = newPlan
      }

      // Create learning items - ensure all required fields are present
      const learningItems = modules.map((module, index) => ({
        learning_plan_id: learningPlan.id,
        title: module.title || `Module ${index + 1}`,
        objectives: module.objectives || `Learn and master the concepts covered in ${module.title || `Module ${index + 1}`}`,
        estimated_time: module.estimatedTime || Math.round((parseInt(formData.months) * 4 * parseInt(formData.hoursPerWeek)) / Math.max(1, modules.length)),
        prerequisites: module.prerequisites || (index > 0 ? `Completion of ${modules[index - 1]?.title || `Module ${index}`}` : ''),
        order_index: index + 1
      }))

      console.log('Creating learning items:', learningItems)

      const { error: itemsError } = await supabase
        .from('learning_items')
        .insert(learningItems)

      if (itemsError) {
        console.error('Error creating learning items:', itemsError)
        throw itemsError
      }

      console.log(`Successfully created ${learningItems.length} learning items`)
      
      // Verify the plan status was updated correctly
      if (planId) {
        const { data: verifyPlan } = await supabase
          .from('learning_plans')
          .select('status')
          .eq('id', planId)
          .single()
        
        console.log('Plan status after update:', verifyPlan?.status)
        
        if (verifyPlan?.status !== 'pending_approval') {
          console.error('Status update failed! Current status:', verifyPlan?.status)
          toast.error('Failed to update plan status. Please try again.')
          return
        }
      }
      
      toast.success('Learning plan submitted for approval!')
      
      // Clear local state
      setPlanId(null)
      setGeneratedPlan('')
      setAdjustedPlan('')
      setChatMessages([])
      
      // Redirect to dashboard - the dashboard will reload data on mount
      router.push('/learner/dashboard')
      router.refresh() // Force refresh to reload data
    } catch (error) {
      console.error('Error submitting plan:', error)
      toast.error(error.message || 'Failed to submit learning plan')
    } finally {
      setLoading(false)
    }
  }

  const parseLearningPlan = (planText) => {
    // Parse modules from AI-generated plan text
    // Format: **Module X: Title** followed by Objectives, Estimated Time, Prerequisites
    if (!planText || planText.trim().length === 0) {
      return []
    }

    const expectedModules = Math.ceil(parseInt(formData.months) * 4)
    const totalHours = parseInt(formData.months) * 4 * parseInt(formData.hoursPerWeek)
    const avgHoursPerModule = totalHours / Math.max(1, expectedModules)

    // Split by double newlines or module markers to get module sections
    const sections = planText.split(/\n\s*\n/).filter(s => s.trim().length > 0)
    const modules = []

    // Also try splitting by module markers
    const moduleSections = planText.split(/(?=\*\*?Module\s+\d+[:\-]?)/i)
    
    for (let section of moduleSections) {
      const lines = section.split('\n').map(l => l.trim()).filter(l => l.length > 0)
      if (lines.length === 0) continue

      // Look for module header: **Module X: Title** or Module X: Title
      const moduleHeaderMatch = lines[0].match(/\*\*?Module\s+(\d+)[:\-]?\s*(.+?)\*\*?/i) || 
                                lines[0].match(/^Module\s+(\d+)[:\-]?\s*(.+)/i)
      
      if (!moduleHeaderMatch) continue

      const moduleNumber = parseInt(moduleHeaderMatch[1])
      const moduleTitle = moduleHeaderMatch[2].trim()
      
      // Skip if we already have this module number
      if (modules.find(m => m.moduleNumber === moduleNumber)) continue

      const module = {
        moduleNumber,
        title: moduleTitle,
        objectives: '',
        estimatedTime: Math.round(avgHoursPerModule),
        prerequisites: ''
      }

      // Parse the rest of the section
      let currentField = null
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        
        if (line.match(/^objectives?:/i)) {
          currentField = 'objectives'
          const afterColon = line.split(/[:\-]/).slice(1).join(':').trim()
          if (afterColon) {
            module.objectives = afterColon
          }
        } else if (line.match(/^estimated\s+time:/i) || line.match(/^time:/i)) {
          currentField = 'time'
          const timeMatch = line.match(/(\d+)\s*hour/i) || line.match(/(\d+)\s*h\b/i)
          if (timeMatch && timeMatch[1]) {
            const hours = parseInt(timeMatch[1])
            if (hours > 0) {
              module.estimatedTime = Math.min(hours, parseInt(formData.hoursPerWeek))
            }
          }
        } else if (line.match(/^prerequisites?:/i)) {
          currentField = 'prerequisites'
          const afterColon = line.split(/[:\-]/).slice(1).join(':').trim()
          if (afterColon && afterColon.toLowerCase() !== 'none') {
            module.prerequisites = afterColon
          }
        } else if (currentField === 'objectives' && line.length > 5) {
          // Continue objectives on next lines
          module.objectives = module.objectives ? `${module.objectives} ${line}` : line
        } else if (currentField === 'time' && line.match(/(\d+)\s*hour/i)) {
          const timeMatch = line.match(/(\d+)\s*hour/i)
          if (timeMatch && timeMatch[1]) {
            const hours = parseInt(timeMatch[1])
            if (hours > 0) {
              module.estimatedTime = Math.min(hours, parseInt(formData.hoursPerWeek))
            }
          }
        } else if (currentField === 'prerequisites' && line.length > 0 && line.toLowerCase() !== 'none') {
          module.prerequisites = module.prerequisites ? `${module.prerequisites} ${line}` : line
        } else if (!currentField && line.length > 10 && !line.match(/^(Module|Objectives|Estimated|Time|Prerequisites)/i)) {
          // If no field detected yet, might be objectives
          if (!module.objectives) {
            module.objectives = line
          }
        }
      }

      // Only add if we have a valid title
      if (module.title && module.title.length > 3) {
        modules.push(module)
      }
    }

    // Sort by module number and limit to expected count
    modules.sort((a, b) => a.moduleNumber - b.moduleNumber)
    
    // Remove duplicates and limit to expected modules
    const uniqueModules = []
    const seenNumbers = new Set()
    for (const mod of modules) {
      if (!seenNumbers.has(mod.moduleNumber) && uniqueModules.length < expectedModules * 1.5) {
        seenNumbers.add(mod.moduleNumber)
        uniqueModules.push(mod)
      }
    }

    // Limit to expected number
    const finalModules = uniqueModules.slice(0, expectedModules)

    // Clean up and ensure proper format
    const cleanedModules = finalModules.map((module) => {
      return {
        title: module.title.includes('Module') && !module.title.match(/^Module\s+\d+:/i)
          ? `Module ${module.moduleNumber}: ${module.title.replace(/^Module\s+\d+[:\-]?\s*/i, '')}`
          : module.title,
        objectives: (module.objectives && module.objectives.trim() && module.objectives.length > 10)
          ? module.objectives.trim()
          : `Learn and master the concepts covered in ${module.title}`,
        estimatedTime: module.estimatedTime || Math.round(avgHoursPerModule),
        prerequisites: (module.prerequisites && module.prerequisites.trim() && module.prerequisites.toLowerCase() !== 'none')
          ? module.prerequisites.trim()
          : ''
      }
    })

    // If we don't have enough modules, create defaults
    if (cleanedModules.length < expectedModules) {
      const existingNumbers = new Set(cleanedModules.map((_, i) => i + 1))
      for (let i = 1; i <= expectedModules; i++) {
        if (!existingNumbers.has(i)) {
          cleanedModules.splice(i - 1, 0, {
            title: `Module ${i}: Learning Objectives`,
            objectives: `Complete the learning objectives for module ${i}`,
            estimatedTime: Math.round(avgHoursPerModule),
            prerequisites: i > 1 ? `Completion of Module ${i - 1}` : ''
          })
        }
      }
    }

    console.log('Parsed modules:', cleanedModules)
    console.log('Expected:', expectedModules, 'Found:', cleanedModules.length)
    
    return cleanedModules.slice(0, expectedModules)
  }

  const availableTechStacks = techStacks.filter(ts =>
    !formData.selectedTechStacks.find(st => (typeof st === 'object' ? st.techStackId : st) === ts.id)
  )

  // If user has an active plan, show message instead of form
  if (hasActivePlan && existingPlan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-teal-50 p-4 py-8">
        <div className="container mx-auto max-w-4xl space-y-6">
          <Card className="border-2 border-indigo-200">
            <CardHeader>
              <CardTitle className="text-2xl">You Already Have an Active Learning Plan</CardTitle>
              <CardDescription>
                You can only have one active learning plan at a time. Please complete your current plan before creating a new one.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-indigo-50 rounded-lg">
                <h3 className="font-semibold mb-2">Current Active Plan:</h3>
                <p className="text-sm text-muted-foreground mb-4">{existingPlan.goals}</p>
                <div className="flex gap-2 text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="default" className="bg-indigo-600">
                    {existingPlan.status === 'in_progress' ? 'In Progress' : 'Active'}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-4">
                <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
                  <Link href={`/learner/learn/${existingPlan.id}`}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    Continue Learning
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/learner/dashboard">
                    Go to Dashboard
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-teal-50">
      {/* Header */}
      <nav className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserIcon className="h-6 w-6 text-indigo-600" />
            <h1 className="text-xl font-bold text-gray-900">Learner Portal</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{userName}</p>
              <p className="text-xs text-gray-500">{userEmail}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 pb-24 max-w-4xl">
        {/* Back Button */}
        <Link href="/learner/dashboard" className="inline-block mb-6">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create AI-Generated Learning Plan</CardTitle>
            <CardDescription>
              Provide your learning goals and we'll generate a personalized plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="goals">Learning Goal / Objectives *</Label>
              <Textarea
                id="goals"
                placeholder="Describe what you want to learn and achieve... (e.g., Master React and build modern web applications)"
                value={formData.goals}
                onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
                rows={4}
                className="resize-none"
                required
              />
              <p className="text-xs text-muted-foreground">
                Be specific about your learning objectives and desired outcomes
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hoursPerWeek">Hours Per Week *</Label>
                <Input
                  id="hoursPerWeek"
                  type="number"
                  min="1"
                  placeholder="e.g., 10"
                  value={formData.hoursPerWeek}
                  onChange={(e) => setFormData({ ...formData, hoursPerWeek: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  How much time can you dedicate weekly?
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="months">Duration (Months) *</Label>
                <Input
                  id="months"
                  type="number"
                  min="1"
                  placeholder="e.g., 3"
                  value={formData.months}
                  onChange={(e) => setFormData({ ...formData, months: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Timeline for completing this plan
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Is this learning plan related to your existing project? *</Label>
              <div className="flex items-center gap-6">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="projectYes"
                    name="isProjectRelated"
                    checked={formData.isProjectRelated === true}
                    onChange={() => setFormData({ ...formData, isProjectRelated: true })}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <Label htmlFor="projectYes" className="font-normal cursor-pointer">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="projectNo"
                    name="isProjectRelated"
                    checked={formData.isProjectRelated === false}
                    onChange={() => setFormData({ ...formData, isProjectRelated: false })}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <Label htmlFor="projectNo" className="font-normal cursor-pointer">No</Label>
                </div>
              </div>
              {formData.isProjectRelated && (
                <div className="mt-3">
                  <Input
                    placeholder="Project name"
                    value={formData.projectName}
                    onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                    className="max-w-md"
                  />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label>Select Tech Stacks for this Learning Plan *</Label>
              <p className="text-sm text-muted-foreground">
                Choose from your profile. Need to add more? Update your profile first.
              </p>
              <div className="space-y-3">
                {userTechStacks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No tech stacks in your profile. Please update your profile first.
                  </p>
                ) : (
                  userTechStacks.map(ts => {
                    const techStackId = ts.id
                    const isSelected = formData.selectedTechStacks.some(st => 
                      (typeof st === 'object' ? st.techStackId : st) === techStackId
                    )
                    return (
                      <div key={techStackId} className="flex items-center space-x-2">
                        <Checkbox
                          id={`tech-${techStackId}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData({
                                ...formData,
                                selectedTechStacks: [...formData.selectedTechStacks, techStackId]
                              })
                            } else {
                              setFormData({
                                ...formData,
                                selectedTechStacks: formData.selectedTechStacks.filter(st => 
                                  (typeof st === 'object' ? st.techStackId : st) !== techStackId
                                )
                              })
                            }
                          }}
                        />
                        <Label htmlFor={`tech-${techStackId}`} className="font-normal cursor-pointer">{ts.name}</Label>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={handleGeneratePlan}
                disabled={generating || !formData.goals || !formData.hoursPerWeek || !formData.months || formData.selectedTechStacks.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                size="lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Learning Plan
                  </>
                )}
              </Button>
            </div>

            {generatedPlan && (
              <div className="space-y-6">
                {/* Two Column Layout */}
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Left Panel: Learning Plan Details */}
                  <Card className="border-2">
                    <CardHeader>
                      <CardTitle className="text-xl">Learning Plan Details</CardTitle>
                      <CardDescription>Review and edit the learning plan as needed</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-semibold text-lg mb-2">Plan Content</h3>
                          <div className="prose prose-sm max-w-none">
                            <div className="whitespace-pre-wrap text-sm leading-relaxed bg-gray-50 p-4 rounded-lg border max-h-[500px] overflow-y-auto">
                              {adjustedPlan || generatedPlan}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Right Panel: AI Assistant */}
                  <Card className="border-2">
                    <CardHeader>
                      <CardTitle className="text-xl flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        AI Assistant
                      </CardTitle>
                      <CardDescription>Chat with AI to improve and adjust the learning plan</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Chat Messages */}
                      <div className="space-y-2 max-h-[400px] overflow-y-auto border rounded-lg p-4 bg-gray-50 min-h-[200px]">
                        {chatMessages.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full py-8">
                            <MessageSquare className="h-12 w-12 text-gray-300 mb-2" />
                            <p className="text-sm text-muted-foreground text-center">
                              No messages yet
                            </p>
                            <p className="text-xs text-muted-foreground text-center mt-1">
                              Ask the AI to help refine the learning plan
                            </p>
                          </div>
                        ) : (
                          chatMessages.map((msg, idx) => {
                            // Check if message is from AI
                            // AI messages are identified by:
                            // 1. sender field is 'ai' (for local messages)
                            // 2. message starts with '[AI]' prefix (for database messages)
                            // 3. message matches the AI response pattern
                            const isAIMessage = msg.sender === 'ai' || 
                                              msg.message?.startsWith('[AI]') ||
                                              msg.message === 'Learning plan has been updated based on your feedback.'
                            
                            // Check if message is from user
                            const isUser = !isAIMessage && (msg.users?.role === 'learner' || msg.sender === 'user')
                            
                            // Clean message text (remove [AI] prefix if present)
                            const messageText = msg.message?.startsWith('[AI]') 
                              ? msg.message.replace('[AI]', '').trim()
                              : msg.message
                            
                            return (
                              <div
                                key={idx}
                                className={`p-3 rounded-lg mb-2 ${
                                  isUser
                                    ? 'bg-indigo-100 ml-auto max-w-[80%]'
                                    : 'bg-white mr-auto max-w-[80%] border'
                                }`}
                              >
                                <p className="text-xs font-medium mb-1 text-gray-600">
                                  {isUser ? 'You' : isAIMessage ? 'AI' : msg.users?.role === 'admin' ? 'Admin' : 'AI'}
                                </p>
                                <p className="text-sm">{messageText}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(msg.created_at).toLocaleTimeString()}
                                </p>
                              </div>
                            )
                          })
                        )}
                      </div>

                      {/* Chat Input */}
                      <div className="flex gap-2">
                        <Input
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                          placeholder="Ask AI to adjust the plan... (e.g., 'Add more practical exercises' or 'Reduce the timeline')"
                          disabled={improving}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleSendMessage}
                          disabled={improving || !newMessage.trim()}
                          className="bg-indigo-600 hover:bg-indigo-700"
                          size="icon"
                        >
                          {improving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      {/* Tip */}
                      <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <BookOpen className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-blue-800">
                          <span className="font-semibold">Tip:</span> You can ask the AI to adjust difficulty, add specific topics, or restructure modules.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Bottom Action Bar */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-10">
                  <div className="container mx-auto max-w-7xl flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BookOpen className="h-4 w-4" />
                      <span>Ready to submit your learning plan for admin approval</span>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Submit for Approval
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function CreateLearningPlanPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <CreateLearningPlanPageContent />
    </Suspense>
  )
}
