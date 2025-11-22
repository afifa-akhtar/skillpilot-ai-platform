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
import { BookOpen, Plus, CheckCircle, Clock, FileText, LogOut, User, Edit, Medal, ArrowRight, ChevronDown, Eye } from 'lucide-react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function LearnerDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [learningPlans, setLearningPlans] = useState([])
  const [currentPlan, setCurrentPlan] = useState(null)
  const [draftPlan, setDraftPlan] = useState(null)
  const [pendingPlan, setPendingPlan] = useState(null)
  const [learningItems, setLearningItems] = useState([])
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [showPendingDetails, setShowPendingDetails] = useState(false)

  useEffect(() => {
    checkAuth()
    loadData()
  }, [])

  // Reload data when component becomes visible (e.g., after returning from another page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData()
      }
    }
    const handleFocus = () => {
      loadData()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
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
      
      // Get user name from profile or email (userData already fetched above)
      if (userData) {
        const emailName = authUser.email?.split('@')[0] || 'User'
        setUserName(userData.full_name || emailName)
      } else {
        const emailName = authUser.email?.split('@')[0] || 'User'
        setUserName(emailName)
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
      } else {
        setCurrentPlan(null)
      }

      // Load pending approval plan (only one plan can be pending at a time)
      const pendingApprovalPlan = plans?.find(p => p.status === 'pending_approval')
      console.log('Pending approval plan found:', pendingApprovalPlan ? { id: pendingApprovalPlan.id, status: pendingApprovalPlan.status } : 'none')
      if (pendingApprovalPlan) {
        setPendingPlan(pendingApprovalPlan)
      } else {
        setPendingPlan(null)
      }

      // Load draft plan if exists (only show if status is still 'draft', not 'pending_approval')
      const draftPlan = plans?.find(p => p.status === 'draft')
      console.log('Draft plan found:', draftPlan ? { id: draftPlan.id, status: draftPlan.status } : 'none')
      if (draftPlan) {
        setDraftPlan(draftPlan)
      } else {
        // Clear draft plan if it no longer exists or status changed
        setDraftPlan(null)
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
      <nav className="bg-white border-b relative z-10 overflow-visible">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-teal-500 bg-clip-text text-transparent">
            SkillPilot AI
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{userName}</span>
              <span className="text-sm text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">{userEmail}</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <User className="mr-2 h-4 w-4" />
                  {profile?.is_complete ? 'Edit Profile' : 'Complete Profile'}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 z-[100] bg-white" sideOffset={5}>
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/learner/profile" className="cursor-pointer w-full">
                    <User className="mr-2 h-4 w-4" />
                    {profile?.is_complete ? 'Edit Profile' : 'Complete Profile'}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      {/* Pending Plan Details Dialog */}
      <Dialog open={showPendingDetails} onOpenChange={setShowPendingDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Learning Plan Details - Pending Approval</DialogTitle>
            <DialogDescription>
              Your learning plan is currently under review by the admin team.
            </DialogDescription>
          </DialogHeader>
          {pendingPlan && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Goals</h3>
                <p className="text-sm text-muted-foreground">{pendingPlan.goals}</p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Time Commitment</h3>
                  <p className="text-sm">{pendingPlan.hours_per_week} hours/week • {pendingPlan.months} months</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Submitted</h3>
                  <p className="text-sm">{new Date(pendingPlan.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {pendingPlan.is_project_related && pendingPlan.project_name && (
                <div>
                  <h3 className="font-semibold mb-2">Related Project</h3>
                  <p className="text-sm">{pendingPlan.project_name}</p>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Learning Plan Content</h3>
                <div className="whitespace-pre-wrap text-sm leading-relaxed bg-gray-50 p-4 rounded-lg border max-h-[400px] overflow-y-auto">
                  {pendingPlan.adjusted_plan || pendingPlan.generated_plan || 'No plan content available'}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setShowPendingDetails(false)} variant="outline">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                    <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                             <BookOpen className="mr-2 h-4 w-4" />
                      <Link href={`/learner/learn/${currentPlan.id}`}>
                        Continue Learning
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : pendingPlan ? (
              <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">Pending Approval</CardTitle>
                      <CardDescription className="mt-2">{pendingPlan.goals}</CardDescription>
                    </div>
                    <Badge variant="outline" className="border-orange-500 text-orange-700">
                      Pending Approval
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Time Commitment:</span>
                      <p className="font-medium">{pendingPlan.hours_per_week} hours/week • {pendingPlan.months} months</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Submitted:</span>
                      <p className="font-medium">{new Date(pendingPlan.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <Button 
                      onClick={() => setShowPendingDetails(true)}
                      className="bg-orange-600 hover:bg-orange-700 text-white w-full sm:w-auto"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : draftPlan ? (
              <Card className="border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-white">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">Draft Learning Plan</CardTitle>
                      <CardDescription className="mt-2">{draftPlan.goals}</CardDescription>
                    </div>
                    <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                      Draft
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Time Commitment:</span>
                      <p className="font-medium">{draftPlan.hours_per_week} hours/week • {draftPlan.months} months</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created:</span>
                      <p className="font-medium">{new Date(draftPlan.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto">
                      <Link href={`/learner/create-plan?draft=${draftPlan.id}`} className="flex items-center justify-center">
                        <Edit className="mr-2 h-4 w-4 text-white" />
                        Continue Editing
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  {!profile || !profile.is_complete ? (
                    <>
                      <p className="text-muted-foreground mb-4">Please complete your profile first</p>
                      <Link href="/learner/profile">
                        <Button className="bg-yellow-500 hover:bg-yellow-600 text-white">
                          <User className="mr-2 h-4 w-4" />
                          Complete Profile
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="text-muted-foreground mb-4">No active learning plan</p>
                      <Link href="/learner/create-plan">
                        <Button className="bg-indigo-600 hover:bg-indigo-700">
                          <Plus className="mr-2 h-4 w-4" />
                          Create Your First Learning Plan
                        </Button>
                      </Link>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="plans" className="space-y-4">
          {learningPlans.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                {!profile || !profile.is_complete ? (
                  <>
                    <p className="text-muted-foreground mb-4">Please complete your profile first</p>
                    <Link href="/learner/profile">
                      <Button className="bg-yellow-500 hover:bg-yellow-600 text-white">
                        <User className="mr-2 h-4 w-4" />
                        Complete Profile
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground mb-4">No learning plans yet</p>
                    {!currentPlan && (
                      <Link href="/learner/create-plan">
                        <Button className="bg-indigo-600 hover:bg-indigo-700">
                          <Plus className="mr-2 h-4 w-4" />
                          Create Your First Plan
                        </Button>
                      </Link>
                    )}
                  </>
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
                        <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white">
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
                  {!profile || !profile.is_complete ? (
                    <>
                      <p className="text-muted-foreground mb-4">Please complete your profile first</p>
                      <Link href="/learner/profile">
                        <Button className="bg-yellow-500 hover:bg-yellow-600 text-white">
                          <User className="mr-2 h-4 w-4" />
                          Complete Profile
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="text-muted-foreground mb-4">No active learning plan</p>
                      <Link href="/learner/create-plan">
                        <Button>
                          <Plus className="mr-2 h-4 w-4" />
                          Create a Learning Plan
                        </Button>
                      </Link>
                    </>
                  )}
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
                    <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white">
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

