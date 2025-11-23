"use client"

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle, Clock, BookOpen, Lock, FileText } from 'lucide-react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

export default function LearnPage() {
  const router = useRouter()
  const params = useParams()
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState(null)
  const [learningItems, setLearningItems] = useState([])

  useEffect(() => {
    loadPlan()
  }, [params.id])

  const loadPlan = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/learner/login')
        return
      }

      const { data: planData, error: planError } = await supabase
        .from('learning_plans')
        .select('*')
        .eq('id', params.id)
        .eq('learner_id', user.id)
        .single()

      if (planError || !planData) {
        throw new Error('Learning plan not found')
      }

      if (planData.status !== 'approved' && planData.status !== 'in_progress') {
        toast.error('This learning plan is not yet approved')
        router.push('/learner/dashboard')
        return
      }

      setPlan(planData)

      // Update status to in_progress if approved
      if (planData.status === 'approved') {
        await supabase
          .from('learning_plans')
          .update({ status: 'in_progress' })
          .eq('id', params.id)
      }

      // Load learning items
      const { data: items, error: itemsError } = await supabase
        .from('learning_items')
        .select('*')
        .eq('learning_plan_id', params.id)
        .order('order_index')

      if (itemsError) throw itemsError
      setLearningItems(items || [])
    } catch (error) {
      console.error('Error loading plan:', error)
      toast.error(error.message || 'Failed to load learning plan')
      router.push('/learner/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const calculateProgress = () => {
    if (learningItems.length === 0) return 0
    const completed = learningItems.filter(item => item.status === 'completed').length
    return Math.round((completed / learningItems.length) * 100)
  }

  const checkAllCompleted = () => {
    return learningItems.length > 0 && learningItems.every(item => item.status === 'completed')
  }

  const canAccessModule = (index) => {
    // First module is always accessible
    if (index === 0) return true
    
    // Check if previous module is completed
    const previousItem = learningItems[index - 1]
    return previousItem && previousItem.status === 'completed'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!plan) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-teal-50 p-4 py-8">
      <div className="container mx-auto max-w-4xl space-y-6">
        <Link href="/learner/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{plan.goals}</CardTitle>
            <CardDescription>
              {plan.hours_per_week} hours/week • {plan.months} months
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Overall Progress</span>
                <span>{calculateProgress()}%</span>
              </div>
              <Progress value={calculateProgress()} />
            </div>

            {checkAllCompleted() && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-green-800">All Learning Items Completed!</h3>
                      <p className="text-sm text-green-700">Take the final quiz to complete your learning plan.</p>
                    </div>
                    <Button asChild className="bg-green-600 hover:bg-green-700">
                      <Link href={`/learner/learn/${params.id}/final-quiz`}>
                        Take Final Quiz
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Learning Items</h2>
          {learningItems.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No learning items found for this plan.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Accordion type="single" collapsible className="w-full">
                  {learningItems.map((item, index) => (
                    <AccordionItem key={item.id} value={`item-${item.id}`} className="px-6 border-b last:border-b-0">
                      <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="flex items-center gap-4 flex-1 text-left">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-sm">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-base mb-1">
                                {item.title || `Module ${index + 1}`}
                              </h3>
                              {item.estimated_time && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {item.estimated_time} {item.estimated_time === 1 ? 'hour' : 'hours'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {!canAccessModule(index) ? (
                                <Badge variant="outline" className="whitespace-nowrap bg-gray-100">
                                  <Lock className="mr-1 h-3 w-3" />
                                  Locked
                                </Badge>
                              ) : item.status === 'completed' ? (
                                <Badge variant="default" className="bg-green-600 whitespace-nowrap">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Completed
                                </Badge>
                              ) : item.status === 'in_progress' ? (
                                <Badge variant="secondary" className="whitespace-nowrap">
                                  <Clock className="mr-1 h-3 w-3" />
                                  In Progress
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="whitespace-nowrap">Not Started</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2 pb-4 pl-12">
                          {item.estimated_time && (
                            <div>
                              <h4 className="font-medium text-sm mb-1 text-muted-foreground">Estimated Time:</h4>
                              <p className="text-sm font-semibold">{item.estimated_time} {item.estimated_time === 1 ? 'hour' : 'hours'}</p>
                            </div>
                          )}
                          
                          {item.objectives && item.objectives.trim() && item.objectives.length > 20 && !item.objectives.includes('Learn and master the concepts') ? (
                            <div>
                              <h4 className="font-medium text-sm mb-2">Objectives:</h4>
                              <p className="text-sm text-muted-foreground">{item.objectives}</p>
                            </div>
                          ) : null}
                          
                          {item.prerequisites && item.prerequisites.trim() && item.prerequisites.length > 0 && item.prerequisites !== `Completion of Module ${index}` && (
                            <div>
                              <h4 className="font-medium text-sm mb-1">Prerequisites:</h4>
                              <p className="text-sm text-muted-foreground">{item.prerequisites}</p>
                            </div>
                          )}
                          
                          <div className="flex justify-end gap-2 pt-2">
                            {canAccessModule(index) ? (
                              <>
                                <Button asChild size="sm" variant="outline">
                                                                      <BookOpen className="mr-2 h-4 w-4" />
                                  <Link href={`/learner/learn/${params.id}/item/${item.id}`}>
                                    {item.status === 'not_started' ? 'Start Learning' : 'Continue Learning'}
                                  </Link>
                                </Button>
                                {item.status === 'in_progress' && (
                                  <Button asChild size="sm" className="bg-teal-500 hover:bg-teal-600">
                                                                          <FileText className="mr-2 h-4 w-4" />

                                    <Link href={`/learner/learn/${params.id}/item/${item.id}/assessment`}>
                                      Take Assessment
                                    </Link>
                                  </Button>
                                )}
                              </>
                            ) : (
                                <div className="flex flex-col items-end gap-2">
                                                                    <BookOpen className="mr-2 h-4 w-4" />

                                <Button size="sm" disabled variant="outline">
                                  Locked
                                </Button>
                                <p className="text-xs text-muted-foreground text-right">
                                  Complete Module {index} to unlock
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

