"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { BookOpen, Plus, CheckCircle, Clock, FileText, LogOut, User, Edit, Medal, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function LearnerDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [learningPlans, setLearningPlans] = useState([])
  const [currentPlan, setCurrentPlan] = useState(null)
  const [learningItems, setLearningItems] = useState([])
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')

  useEffect(() => {
    checkAuth()
    loadData()
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { user: authUser }, error } = await supabase.auth.getUser()
      if (error || !authUser) {
        router.push('/learner/login')
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (userData?.role !== 'learner') {
        await supabase.auth.signOut()
        router.push('/learner/login')
        return
      }

      setUser(authUser)
      setUserEmail(authUser.email || '')
      
      // Get user name from profile or email
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()
      
      if (userData) {
        const emailName = authUser.email?.split('@')[0] || 'User'
        setUserName(userData.full_name || emailName)
      }
    } catch (error) {
      console.error('Auth error:', error)
      router.push('/learner/login')
    }
  }

  const loadData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      // Load profile
      const { data: profileData } = await supabase
        .from('learner_profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .single()

      setProfile(profileData)

      // Load learning plans
      const { data: plans } = await supabase
        .from('learning_plans')
        .select('*')
        .eq('learner_id', authUser.id)
        .order('created_at', { ascending: false })

      setLearningPlans(plans || [])

      // Load current active plan (only one active plan allowed)
      const activePlan = plans?.find(p => p.status === 'approved' || p.status === 'in_progress')
      if (activePlan) {
        setCurrentPlan(activePlan)
        loadLearningItems(activePlan.id)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadLearningItems = async (planId) => {
    try {
      const { data: items } = await supabase
        .from('learning_items')
        .select('*')
        .eq('learning_plan_id', planId)
        .order('order_index')

      setLearningItems(items || [])
    } catch (error) {
      console.error('Error loading learning items:', error)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const getStatusBadge = (status) => {
    const variants = {
      draft: 'outline',
      pending_approval: 'secondary',
      approved: 'default',
      rejected: 'destructive',
      in_progress: 'default',
      completed: 'default'
    }

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    )
  }

  const calculateProgress = (planId) => {
    if (!planId) {
      if (!currentPlan || learningItems.length === 0) return 0
      const completed = learningItems.filter(item => item.status === 'completed').length
      return Math.round((completed / learningItems.length) * 100)
    }
    // For other plans, we'd need to load their items, but for now return 0
    return 0
  }

  const getTotalPoints = () => {
    return learningPlans.reduce((total, plan) => {
      return total + (plan.redeemable_points || 0)
    }, 0)
  }

  const getActivePlansCount = () => {
    return learningPlans.filter(p => p.status === 'approved' || p.status === 'in_progress').length
  }

  const getPendingApprovalCount = () => {
    return learningPlans.filter(p => p.status === 'pending_approval').length
  }

  const getCompletedCount = () => {
    return learningPlans.filter(p => p.status === 'completed').length
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-teal-50">
      <nav className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-teal-500 bg-clip-text text-transparent">
            SkillPilot AI
          </h1>
          <div className="flex items-center gap-4">
            <Link href="/learner/profile">
              <Button variant="outline" size="sm">
                <User className="mr-2 h-4 w-4" />
                {profile?.is_complete ? 'Edit Profile' : 'Complete Profile'}
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="plans">Learning Plans</TabsTrigger>
            <TabsTrigger value="current">Current Learning</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Total Plans</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{learningPlans.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Active Plans</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {learningPlans.filter(p => p.status === 'in_progress' || p.status === 'approved').length}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Completed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {learningPlans.filter(p => p.status === 'completed').length}
                  </div>
                </CardContent>
              </Card>
            </div>

            {currentPlan ? (
              <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">Current Learning Plan</CardTitle>
                      <CardDescription className="mt-2">{currentPlan.goals}</CardDescription>
                    </div>
                    <Badge variant="default" className="bg-indigo-600">
                      {currentPlan.status === 'in_progress' ? 'In Progress' : 'Active'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium">Progress</span>
                      <span className="font-semibold text-indigo-600">{calculateProgress()}%</span>
                    </div>
                    <Progress value={calculateProgress()} className="h-2" />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Time Commitment:</span>
                      <p className="font-medium">{currentPlan.hours_per_week} hours/week • {currentPlan.months} months</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Modules:</span>
                      <p className="font-medium">{learningItems.length} modules</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
                      <Link href={`/learner/learn/${currentPlan.id}`}>
                        <BookOpen className="mr-2 h-4 w-4" />
                        Continue Learning
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">No active learning plan</p>
                  <Link href="/learner/create-plan">
                    <Button className="bg-indigo-600 hover:bg-indigo-700">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Learning Plan
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="plans" className="space-y-4">
            {learningPlans.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">No learning plans yet</p>
                  {!currentPlan && (
                    <Link href="/learner/create-plan">
                      <Button className="bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Your First Plan
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {currentPlan && (
                  <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">Active Plan</CardTitle>
                          <CardDescription className="mt-1">{currentPlan.goals}</CardDescription>
                        </div>
                        <Badge variant="default" className="bg-indigo-600">
                          {currentPlan.status === 'in_progress' ? 'In Progress' : 'Active'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                          <Link href={`/learner/learn/${currentPlan.id}`}>
                            <BookOpen className="mr-2 h-4 w-4" />
                            Continue Learning
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {learningPlans.filter(p => p.id !== currentPlan?.id).map(plan => (
                  <Card key={plan.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{plan.goals.substring(0, 50)}...</CardTitle>
                          <CardDescription>
                            {plan.hours_per_week} hours/week • {plan.months} months
                          </CardDescription>
                        </div>
                        {getStatusBadge(plan.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        {plan.status === 'completed' && (
                          <Badge variant="default">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Completed
                          </Badge>
                        )}
                        {plan.status === 'pending_approval' && (
                          <Badge variant="secondary">Waiting for approval</Badge>
                        )}
                        {plan.status === 'rejected' && (
                          <Badge variant="destructive">Rejected</Badge>
                        )}
                        {plan.status === 'draft' && (
                          <Badge variant="outline">Draft</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="current" className="space-y-4">
            {!currentPlan ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">No active learning plan</p>
                  <Link href="/learner/create-plan">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Create a Learning Plan
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>{currentPlan.goals}</CardTitle>
                    <CardDescription>
                      {currentPlan.hours_per_week} hours/week • {currentPlan.months} months
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span>Overall Progress</span>
                        <span>{calculateProgress()}%</span>
                      </div>
                      <Progress value={calculateProgress()} />
                    </div>
                    <Button asChild>
                      <Link href={`/learner/learn/${currentPlan.id}`}>
                        <BookOpen className="mr-2 h-4 w-4" />
                        Continue Learning
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <h3 className="font-semibold">Learning Items</h3>
                  {learningItems.map((item, index) => (
                    <Card key={item.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">
                              {index + 1}
                            </div>
                            <div>
                              <h4 className="font-medium">{item.title}</h4>
                              <p className="text-sm text-muted-foreground">
                                {item.estimated_time} hours
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.status === 'completed' ? (
                              <Badge variant="default">
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Completed
                              </Badge>
                            ) : item.status === 'in_progress' ? (
                              <Badge variant="secondary">
                                <Clock className="mr-1 h-3 w-3" />
                                In Progress
                              </Badge>
                            ) : (
                              <Badge variant="outline">Not Started</Badge>
                            )}
                            {item.status !== 'not_started' && (
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/learner/learn/${currentPlan.id}/item/${item.id}`}>
                                  <FileText className="h-4 w-4" />
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

