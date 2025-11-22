"use client"

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle, XCircle, MessageSquare, Clock, Send, User, GraduationCap, Lightbulb } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

export default function ApprovePlanPage() {
  const router = useRouter()
  const params = useParams()
  const [loading, setLoading] = useState(false)
  const [improving, setImproving] = useState(false)
  const [plan, setPlan] = useState(null)
  const [learningItems, setLearningItems] = useState([])
  const [chatMessages, setChatMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [adjustedPlan, setAdjustedPlan] = useState('')
  const [points, setPoints] = useState(0)

  useEffect(() => {
    loadPlan()
    loadChatMessages()
    // Poll for new messages every 3 seconds
    const interval = setInterval(loadChatMessages, 3000)
    return () => clearInterval(interval)
  }, [params.id])

  const loadPlan = async () => {
    try {
      if (!params.id) {
        toast.error('Invalid plan ID')
        router.push('/admin/dashboard')
        return
      }

      const { data, error } = await supabase
        .from('learning_plans')
        .select(`
          *,
          users!learning_plans_learner_id_fkey (
            email
          )
        `)
        .eq('id', params.id)
        .single()

      if (error) {
        console.error('Error loading plan:', error)
        toast.error('Failed to load learning plan: ' + error.message)
        router.push('/admin/dashboard')
        return
      }

      if (!data) {
        toast.error('Learning plan not found')
        router.push('/admin/dashboard')
        return
      }

      setPlan(data)
      setAdjustedPlan(data.adjusted_plan || data.generated_plan || '')
      setPoints(data.redeemable_points || 0)

      // Load learning items with all details
      const { data: items, error: itemsError } = await supabase
        .from('learning_items')
        .select('*')
        .eq('learning_plan_id', params.id)
        .order('order_index')

      if (itemsError) {
        console.error('Error loading learning items:', itemsError)
      }

      console.log('Loaded learning items:', items)
      setLearningItems(items || [])
    } catch (error) {
      console.error('Error loading plan:', error)
      toast.error('Failed to load learning plan')
    }
  }

  const loadChatMessages = async () => {
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
        .eq('learning_plan_id', params.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setChatMessages(data || [])
    } catch (error) {
      console.error('Error loading chat messages:', error)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return

    const messageText = newMessage.trim()
    setNewMessage('')
    setImproving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Save chat message
      const { error: chatError } = await supabase
        .from('admin_chat_messages')
        .insert({
          learning_plan_id: params.id,
          sender_id: user.id,
          message: messageText
        })

      if (chatError) {
        console.error('Error saving chat message:', chatError)
      }

      // Improve the plan based on the message
      const currentPlan = adjustedPlan || plan.generated_plan || ''
      
      // Get session to include auth token
      const { data: { session } } = await supabase.auth.getSession()
      const headers = {
        'Content-Type': 'application/json'
      }
      
      // Add auth token if available
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
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
      
      // Update in database
      await supabase
        .from('learning_plans')
        .update({
          adjusted_plan: data.improvedPlan
        })
        .eq('id', params.id)

      // Reload learning items if plan changed significantly
      if (data.improvedPlan !== currentPlan) {
        const modules = parseLearningPlan(data.improvedPlan)
        if (modules.length > 0) {
          // Update learning items
          const { error: deleteError } = await supabase
            .from('learning_items')
            .delete()
            .eq('learning_plan_id', params.id)

          if (!deleteError) {
            const learningItemsData = modules.map((module, index) => ({
              learning_plan_id: params.id,
              title: module.title || `Module ${index + 1}`,
              objectives: module.objectives || `Learn and master the concepts covered in ${module.title || `Module ${index + 1}`}`,
              estimated_time: module.estimatedTime || Math.round((plan.hours_per_week * plan.months * 4) / Math.max(1, modules.length)),
              prerequisites: module.prerequisites || (index > 0 ? `Completion of ${modules[index - 1]?.title || `Module ${index}`}` : ''),
              order_index: index + 1
            }))

            await supabase
              .from('learning_items')
              .insert(learningItemsData)
          }
        }
        loadPlan() // Reload to get updated items
      }

      // Add AI response message (prefix with [AI] to identify)
      await supabase
        .from('admin_chat_messages')
        .insert({
          learning_plan_id: params.id,
          sender_id: user.id,
          message: '[AI] Learning plan has been updated based on your feedback.'
        })

      loadChatMessages()
      toast.success('Plan improved and updated!')
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error(error.message || 'Failed to improve plan')
      setNewMessage(messageText) // Restore message on error
    } finally {
      setImproving(false)
    }
  }

  const handleApprove = async () => {
    if (!plan) {
      toast.error('Plan data not loaded')
      return
    }

    // Redeemable points are now optional - no validation needed

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Please log in')
        router.push('/admin/login')
        return
      }

      console.log('Approving plan:', params.id)
      console.log('Adjusted plan length:', adjustedPlan.length)
      console.log('Points:', points)

      // Update plan status
      const { error: planError } = await supabase
        .from('learning_plans')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          adjusted_plan: adjustedPlan || plan.generated_plan || plan.adjusted_plan,
          redeemable_points: points || 0
        })
        .eq('id', params.id)

      if (planError) {
        console.error('Plan update error:', planError)
        throw planError
      }

      // Update learning items if plan was adjusted
      const currentPlanText = plan.generated_plan || plan.adjusted_plan || ''
      if (adjustedPlan && adjustedPlan !== currentPlanText) {
        try {
          // Parse and update learning items (simplified - you might want to improve this)
          const modules = parseLearningPlan(adjustedPlan)
          
          if (modules.length > 0) {
            // Delete existing items
            const { error: deleteError } = await supabase
              .from('learning_items')
              .delete()
              .eq('learning_plan_id', params.id)

            if (deleteError) {
              console.warn('Error deleting old items:', deleteError)
            }

            // Insert updated items - ensure all fields are properly set
            const learningItemsData = modules.map((module, index) => ({
              learning_plan_id: params.id,
              title: module.title || `Module ${index + 1}`,
              objectives: module.objectives || `Learn and master the concepts covered in ${module.title || `Module ${index + 1}`}`,
              estimated_time: module.estimatedTime || Math.round((plan.hours_per_week * plan.months * 4) / Math.max(1, modules.length)),
              prerequisites: module.prerequisites || (index > 0 ? `Completion of ${modules[index - 1]?.title || `Module ${index}`}` : ''),
              order_index: index + 1
            }))
            
            console.log('Updating learning items with:', learningItemsData)

            const { error: insertError } = await supabase
              .from('learning_items')
              .insert(learningItemsData)

            if (insertError) {
              console.warn('Error inserting new items:', insertError)
              // Don't fail the approval if items update fails
            }
          }
        } catch (itemError) {
          console.warn('Error updating learning items:', itemError)
          // Don't fail the approval if items update fails
        }
      }

      toast.success('Learning plan approved successfully!')
      // Navigate back to dashboard - it will refresh on visibility change
      setTimeout(() => {
        router.push('/admin/dashboard')
      }, 1000)
    } catch (error) {
      console.error('Error approving plan:', error)
      toast.error(error.message || 'Failed to approve plan')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!confirm('Are you sure you want to reject this learning plan?')) return

    setLoading(true)

    try {
      const { error } = await supabase
        .from('learning_plans')
        .update({
          status: 'rejected',
          admin_notes: newMessage || 'Rejected by admin'
        })
        .eq('id', params.id)

      if (error) throw error

      toast.success('Learning plan rejected')
      // Navigate back to dashboard - it will refresh on visibility change
      router.push('/admin/dashboard')
    } catch (error) {
      console.error('Error rejecting plan:', error)
      toast.error(error.message || 'Failed to reject plan')
    } finally {
      setLoading(false)
    }
  }

  const parseLearningPlan = (planText) => {
    // Parse modules from AI-generated plan text - same logic as learner side
    if (!planText || planText.trim().length === 0) {
      return []
    }

    const expectedModules = plan ? Math.ceil(plan.months * 4) : 8
    const totalHours = plan?.hours_per_week ? plan.hours_per_week * plan.months * 4 : 0
    const avgHoursPerModule = totalHours > 0 ? totalHours / Math.max(1, expectedModules) : 2

    // Split by module markers
    const moduleSections = planText.split(/(?=\*\*?Module\s+\d+[:\-]?)/i)
    const modules = []

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
              module.estimatedTime = Math.min(hours, plan?.hours_per_week || 10)
            }
          }
        } else if (line.match(/^prerequisites?:/i)) {
          currentField = 'prerequisites'
          const afterColon = line.split(/[:\-]/).slice(1).join(':').trim()
          if (afterColon && afterColon.toLowerCase() !== 'none') {
            module.prerequisites = afterColon
          }
        } else if (currentField === 'objectives' && line.length > 5) {
          module.objectives = module.objectives ? `${module.objectives} ${line}` : line
        } else if (currentField === 'time' && line.match(/(\d+)\s*hour/i)) {
          const timeMatch = line.match(/(\d+)\s*hour/i)
          if (timeMatch && timeMatch[1]) {
            const hours = parseInt(timeMatch[1])
            if (hours > 0) {
              module.estimatedTime = Math.min(hours, plan?.hours_per_week || 10)
            }
          }
        } else if (currentField === 'prerequisites' && line.length > 0 && line.toLowerCase() !== 'none') {
          module.prerequisites = module.prerequisites ? `${module.prerequisites} ${line}` : line
        } else if (!currentField && line.length > 10 && !line.match(/^(Module|Objectives|Estimated|Time|Prerequisites)/i)) {
          if (!module.objectives) {
            module.objectives = line
          }
        }
      }

      if (module.title && module.title.length > 3) {
        modules.push(module)
      }
    }

    // Sort by module number and limit to expected count
    modules.sort((a, b) => a.moduleNumber - b.moduleNumber)
    
    // Remove duplicates and limit
    const uniqueModules = []
    const seenNumbers = new Set()
    for (const mod of modules) {
      if (!seenNumbers.has(mod.moduleNumber) && uniqueModules.length < expectedModules * 1.5) {
        seenNumbers.add(mod.moduleNumber)
        uniqueModules.push(mod)
      }
    }

    const finalModules = uniqueModules.slice(0, expectedModules)

    // Clean up
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

    if (cleanedModules.length === 0 && plan) {
      const numModules = Math.ceil((plan.months || 1) * 4)
      for (let i = 1; i <= numModules; i++) {
        cleanedModules.push({
          title: `Module ${i}: Learning Objectives`,
          objectives: `Complete the learning objectives for module ${i}`,
          estimatedTime: Math.round(avgHoursPerModule),
          prerequisites: i > 1 ? `Completion of Module ${i - 1}` : ''
        })
      }
    }

    return cleanedModules.slice(0, expectedModules)
  }

  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-teal-50">
      <div className="container mx-auto px-4 py-6">
        <Link href="/admin/dashboard">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>

        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{plan.goals}</h1>
              <p className="text-gray-600">
                Submitted by <span className="font-medium">{plan.users?.email || 'Unknown'}</span> on{' '}
                {new Date(plan.created_at).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
              {plan.status === 'pending_approval' ? 'Pending Review' : plan.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
          
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <div>
              <span className="font-medium">Duration:</span> {plan.months} {plan.months === 1 ? 'month' : 'months'}
            </div>
            <div>
              <span className="font-medium">Weekly Commitment:</span> {plan.hours_per_week} hours/week
            </div>
            <div>
              <span className="font-medium">Total Modules:</span> {learningItems.length}
            </div>
          </div>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Left Panel: Learning Plan Details */}
          <Card>
            <CardHeader>
              <CardTitle>Learning Plan Details</CardTitle>
              <CardDescription>Review and edit the learning plan as needed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Learning Plan: {plan.goals}</Label>
                <Textarea
                  value={adjustedPlan}
                  onChange={(e) => setAdjustedPlan(e.target.value)}
                  rows={20}
                  className="font-mono text-sm"
                  disabled
                  readOnly
                />
                <p className="text-xs text-muted-foreground">
                  Use the AI Assistant on the right to improve the plan. The plan will update automatically.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="points">Redeemable Points (Optional)</Label>
                <Input
                  id="points"
                  type="number"
                  min="0"
                  value={points}
                  onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
                  placeholder="Enter points (optional)"
                />
                <p className="text-xs text-muted-foreground">
                  Points can be redeemed outside the system upon completion. Leave empty if not applicable.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Right Panel: AI Assistant */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                AI Assistant
              </CardTitle>
              <CardDescription>Chat with AI to improve and adjust the learning plan.</CardDescription>
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
                    const isAIMessage = msg.sender === 'ai' || 
                                      msg.message?.startsWith('[AI]') ||
                                      msg.message === 'Learning plan has been updated based on your feedback.'
                    
                    // Check if message is from admin
                    const isAdmin = msg.users?.role === 'admin' && !isAIMessage
                    
                    // Check if message is from learner
                    const isLearner = msg.users?.role === 'learner' && !isAIMessage
                    
                    // Clean message text (remove [AI] prefix if present)
                    const messageText = msg.message?.startsWith('[AI]') 
                      ? msg.message.replace('[AI]', '').trim()
                      : msg.message
                    
                    return (
                      <div
                        key={msg.id || idx}
                        className={`p-3 rounded-lg mb-2 ${
                          isAdmin
                            ? 'bg-indigo-100 ml-auto max-w-[80%]'
                            : isLearner
                            ? 'bg-blue-100 mr-auto max-w-[80%]'
                            : 'bg-white mr-auto max-w-[80%] border'
                        }`}
                      >
                        <p className="text-xs font-medium mb-1 text-gray-600">
                          {isAdmin ? 'You (Admin)' : isLearner ? 'Learner' : isAIMessage ? 'AI' : 'System'}
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
                <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-800">
                  <span className="font-semibold">Tip:</span> You can ask the AI to adjust difficulty, add specific topics, or restructure modules.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-4 py-4 z-10">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <GraduationCap className="h-5 w-5 text-indigo-600" />
              <span>
                {points > 0 ? (
                  <>Allocating <span className="font-bold text-green-600">{points} points</span> upon completion</>
                ) : (
                  <>No points allocated (optional)</>
                )}
              </span>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleReject}
                disabled={loading}
                variant="outline"
                className="border-gray-300"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject Plan
              </Button>
              <Button
                onClick={handleApprove}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {loading ? 'Approving...' : 'Approve Plan'}
              </Button>
            </div>
          </div>
        </div>

        {/* Add padding to bottom to account for fixed action bar */}
        <div className="h-20"></div>
      </div>
    </div>
  )
}

