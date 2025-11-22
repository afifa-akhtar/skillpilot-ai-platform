"use client"

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Users, Settings, LogOut, Plus, CheckCircle, Clock, XCircle, ArrowLeft, BookOpen, FileText } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import Link from 'next/link'

export default function AdminDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [learners, setLearners] = useState([])
  const [learningPlans, setLearningPlans] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedLearner, setSelectedLearner] = useState(null)
  const [learnerDetails, setLearnerDetails] = useState(null)
  const [stats, setStats] = useState({
    totalLearners: 0,
    pendingApprovals: 0,
    inProgress: 0,
    completed: 0
  })

  useEffect(() => {
    checkAuth()
    loadData()
    
    // Check for tab in URL params
    const tab = searchParams.get('tab')
    if (tab && ['overview', 'learners', 'plans', 'pending'].includes(tab)) {
      setActiveTab(tab)
    }

    // Reload data when tab becomes visible or window regains focus (e.g., after returning from approve page)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, reloading admin dashboard data...')
        loadData()
      }
    }

    const handleFocus = () => {
      console.log('Window regained focus, reloading admin dashboard data...')
      loadData()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [searchParams])

  const checkAuth = async () => {
    try {
      const { data: { user: authUser }, error } = await supabase.auth.getUser()
      if (error || !authUser) {
        router.push('/admin/login')
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (userData?.role !== 'admin') {
        await supabase.auth.signOut()
        router.push('/admin/login')
        return
      }

      setUser(authUser)
    } catch (error) {
      console.error('Auth error:', error)
      router.push('/admin/login')
    }
  }

  const loadData = async () => {
    try {
      // Load learners with their learning plans
      // Note: This requires admin RLS policy to see all users
      const { data: learnersData, error: learnersError } = await supabase
        .from('users')
        .select(`
          *,
          learning_plans!learning_plans_learner_id_fkey (
            id,
            status,
            goals,
            created_at
          )
        `)
        .eq('role', 'learner')
        .order('created_at', { ascending: false })

      if (learnersError) {
        console.error('Error loading learners:', learnersError)
        toast.error('Failed to load learners. Please check RLS policies.')
      }

      setLearners(learnersData || [])

      // Load learning plans
      const { data: plans } = await supabase
        .from('learning_plans')
        .select(`
          *,
          users!learning_plans_learner_id_fkey (
            email
          )
        `)
        .order('created_at', { ascending: false })

      setLearningPlans(plans || [])

      // Calculate stats - ensure we're counting correctly
      const totalLearnersCount = learnersData?.length || 0
      const pendingPlans = plans?.filter(p => p.status === 'pending_approval') || []
      // In Progress includes both 'approved' (ready to start) and 'in_progress' (actively being worked on)
      const inProgressPlans = plans?.filter(p => p.status === 'approved' || p.status === 'in_progress') || []
      const completedPlans = plans?.filter(p => p.status === 'completed') || []

      console.log('Dashboard Stats:', {
        totalLearners: totalLearnersCount,
        pendingApprovals: pendingPlans.length,
        inProgress: inProgressPlans.length,
        completed: completedPlans.length,
        allPlans: plans?.length || 0
      })

      setStats({
        totalLearners: totalLearnersCount,
        pendingApprovals: pendingPlans.length,
        inProgress: inProgressPlans.length,
        completed: completedPlans.length
      })
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const loadLearnerDetails = async (learnerId) => {
    try {
      // Load learner's learning plans with learning items
      const { data: plans } = await supabase
        .from('learning_plans')
        .select(`
          *,
          learning_items (
            id,
            title,
            status,
            order_index,
            estimated_time,
            completed_at
          )
        `)
        .eq('learner_id', learnerId)
        .order('created_at', { ascending: false })

      // Load learner profile
      const { data: profile } = await supabase
        .from('learner_profiles')
        .select('*')
        .eq('user_id', learnerId)
        .single()

      setLearnerDetails({
        plans: plans || [],
        profile: profile || null
      })
      setSelectedLearner(learnerId)
    } catch (error) {
      console.error('Error loading learner details:', error)
      toast.error('Failed to load learner details')
    }
  }

  const calculatePlanProgress = (items) => {
    if (!items || items.length === 0) return 0
    const completed = items.filter(item => item.status === 'completed').length
    return Math.round((completed / items.length) * 100)
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

  const getLearnerProgress = (learner) => {
    const activePlans = learner.learning_plans?.filter(p => 
      p.status === 'approved' || p.status === 'in_progress'
    ) || []
    
    if (activePlans.length === 0) return null
    
    // For now, return the first active plan's status
    // In a real scenario, you'd calculate overall progress
    return {
      hasActivePlan: true,
      planCount: activePlans.length
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto"></div>
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
            SkillPilot AI - Admin
          </h1>
          <div className="flex items-center gap-4">
            <Link href="/admin/tech-stacks">
              <Button variant="outline" size="sm">
                <Settings className="mr-2 h-4 w-4" />
                Manage Tech Stacks
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="learners">Learners</TabsTrigger>
            <TabsTrigger value="plans">Learning Plans</TabsTrigger>
            <TabsTrigger value="pending">Pending Approvals</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-4 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-600" />
                    Total Learners
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.totalLearners}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5 text-yellow-600" />
                    Pending
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.pendingApprovals}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    In Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.inProgress}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Completed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.completed}</div>
                </CardContent>
              </Card>
            </div>

            {/* Learners List with Pending Plans */}
            <Card className="border-2 border-indigo-200">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Users className="h-6 w-6 text-indigo-600" />
                  Learners & Pending Plans
                </CardTitle>
                <CardDescription>
                  Review and approve learning plans for each learner
                </CardDescription>
              </CardHeader>
              <CardContent>
                {learners.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No learners registered yet</p>
                ) : (
                  <div className="space-y-3">
                    {learners.map(learner => {
                      // Find plans for this learner (only one plan per learner)
                      const activePlan = learningPlans.find(
                        p => p.learner_id === learner.id && (p.status === 'approved' || p.status === 'in_progress')
                      )
                      const completedPlan = learningPlans.find(
                        p => p.learner_id === learner.id && p.status === 'completed'
                      )
                      // Only show pending plan if there's no active or completed plan
                      const pendingPlan = !activePlan && !completedPlan ? learningPlans.find(
                        p => p.learner_id === learner.id && p.status === 'pending_approval'
                      ) : null
                      const anyPlan = learningPlans.find(p => p.learner_id === learner.id)

                      return (
                        <div
                          key={learner.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-indigo-50 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <p className="font-medium text-lg">{learner.email}</p>
                              {pendingPlan && (
                                <Badge variant="default" className="bg-yellow-600">
                                  <Clock className="mr-1 h-3 w-3" />
                                  Pending Approval
                                </Badge>
                              )}
                              {activePlan && (
                                <Badge variant="default" className="bg-blue-600">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  In Progress
                                </Badge>
                              )}
                              {completedPlan && (
                                <Badge variant="default" className="bg-green-600">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Completed
                                </Badge>
                              )}
                              {!anyPlan && (
                                <Badge variant="outline">No Plan</Badge>
                              )}
                            </div>
                            {pendingPlan && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Plan: {pendingPlan.goals.substring(0, 60)}...
                              </p>
                            )}
                            {activePlan && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Active Plan: {activePlan.goals.substring(0, 60)}...
                              </p>
                            )}
                            {completedPlan && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Completed Plan: {completedPlan.goals.substring(0, 60)}...
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {pendingPlan ? (
                              <Button asChild className="bg-yellow-600 hover:bg-yellow-700">
                                <Link href={`/admin/approve-plan/${pendingPlan.id}`}>
                                  Review & Approve Plan
                                </Link>
                              </Button>
                            ) : anyPlan ? (
                              <Button asChild variant="outline">
                                <Link href={`/admin/approve-plan/${anyPlan.id}`}>
                                  View Plan
                                </Link>
                              </Button>
                            ) : (
                              <Button variant="outline" disabled>
                                No Plan
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => loadLearnerDetails(learner.id)}
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* All Learning Plans */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">All Learning Plans</h2>
                <Button variant="outline" onClick={() => setActiveTab('plans')}>
                  View All
                </Button>
              </div>
              {learningPlans.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No learning plans yet</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {learningPlans.slice(0, 6).map(plan => (
                    <Card key={plan.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base">{plan.goals.substring(0, 50)}...</CardTitle>
                            <CardDescription className="mt-1">
                              {plan.users?.email || 'Unknown'} • {plan.hours_per_week}h/week • {plan.months}mo
                            </CardDescription>
                          </div>
                          {getStatusBadge(plan.status)}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Button asChild size="sm" variant="outline" className="w-full">
                          <Link href={`/admin/approve-plan/${plan.id}`}>
                            View Details
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="learners" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Learners</CardTitle>
                <CardDescription>Click on a learner to view their progress and details</CardDescription>
              </CardHeader>
              <CardContent>
                {learners.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No learners registered yet</p>
                ) : (
                  <div className="space-y-2">
                    {learners.map(learner => {
                      const progress = getLearnerProgress(learner)
                      const planCount = learner.learning_plans?.length || 0
                      return (
                        <div 
                          key={learner.id} 
                          onClick={() => loadLearnerDetails(learner.id)}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-indigo-50 cursor-pointer transition-colors"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-lg">{learner.email}</p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span>Joined {new Date(learner.created_at).toLocaleDateString()}</span>
                              {planCount > 0 && (
                                <span>• {planCount} learning plan{planCount !== 1 ? 's' : ''}</span>
                              )}
                              {progress?.hasActivePlan && (
                                <Badge variant="default" className="bg-indigo-600">
                                  Active Plan
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            View Details
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plans" className="space-y-4">
            {learningPlans.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No learning plans yet</p>
                </CardContent>
              </Card>
            ) : (
              learningPlans.map(plan => (
                <Card key={plan.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{plan.goals.substring(0, 60)}...</CardTitle>
                        <CardDescription>
                          Learner: {plan.users?.email || 'Unknown'} • {plan.hours_per_week} hours/week • {plan.months} months
                        </CardDescription>
                      </div>
                      {getStatusBadge(plan.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button asChild size="sm">
                        <Link href={`/admin/approve-plan/${plan.id}`}>
                          View Details
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            {(() => {
              const pendingPlans = learningPlans.filter(p => p.status === 'pending_approval')
              return pendingPlans.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No pending approvals</p>
                  </CardContent>
                </Card>
              ) : (
                pendingPlans.map(plan => (
                  <Card key={plan.id} className="border-yellow-200">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{plan.goals.substring(0, 60)}...</CardTitle>
                          <CardDescription>
                            Learner: {plan.users?.email || 'Unknown'} • {plan.hours_per_week} hours/week • {plan.months} months
                          </CardDescription>
                        </div>
                        {getStatusBadge(plan.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button asChild>
                        <Link href={`/admin/approve-plan/${plan.id}`}>
                          Review & Approve
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )
            })()}
          </TabsContent>
        </Tabs>
      </div>

      {/* Learner Details Dialog */}
      {selectedLearner && (
        <Dialog open={!!selectedLearner} onOpenChange={(open) => !open && setSelectedLearner(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Learner Details
              </DialogTitle>
              <DialogDescription>
                {learners.find(l => l.id === selectedLearner)?.email}
              </DialogDescription>
            </DialogHeader>
            
            {learnerDetails && (
              <div className="space-y-6">
                {/* Profile Information */}
                {learnerDetails.profile && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Profile Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Role/Designation</p>
                          <p className="font-medium">{learnerDetails.profile.role_designation || 'Not specified'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Experience</p>
                          <p className="font-medium">{learnerDetails.profile.total_experience || 0} years</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Learning Plans */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Learning Plans</h3>
                  {learnerDetails.plans.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        No learning plans yet
                      </CardContent>
                    </Card>
                  ) : (
                    learnerDetails.plans.map(plan => {
                      const progress = calculatePlanProgress(plan.learning_items)
                      const completedItems = plan.learning_items?.filter(item => item.status === 'completed').length || 0
                      const totalItems = plan.learning_items?.length || 0
                      
                      return (
                        <Card key={plan.id} className="border-2">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-lg">{plan.goals}</CardTitle>
                                <CardDescription className="mt-2">
                                  {plan.hours_per_week} hours/week • {plan.months} months
                                </CardDescription>
                              </div>
                              {getStatusBadge(plan.status)}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Progress */}
                            {totalItems > 0 && (
                              <div>
                                <div className="flex justify-between text-sm mb-2">
                                  <span className="font-medium">Overall Progress</span>
                                  <span className="font-semibold text-indigo-600">
                                    {progress}% ({completedItems}/{totalItems} modules)
                                  </span>
                                </div>
                                <Progress value={progress} className="h-2" />
                              </div>
                            )}

                            {/* Learning Items/Modules */}
                            {plan.learning_items && plan.learning_items.length > 0 ? (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm">Modules:</h4>
                                <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                                  {plan.learning_items
                                    .sort((a, b) => a.order_index - b.order_index)
                                    .map((item, index) => (
                                      <div
                                        key={item.id}
                                        className={`flex items-center justify-between p-2 rounded ${
                                          item.status === 'completed'
                                            ? 'bg-green-50 border border-green-200'
                                            : item.status === 'in_progress'
                                            ? 'bg-blue-50 border border-blue-200'
                                            : 'bg-gray-50 border border-gray-200'
                                        }`}
                                      >
                                        <div className="flex items-center gap-3 flex-1">
                                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-sm">
                                            {index + 1}
                                          </div>
                                          <div className="flex-1">
                                            <p className="font-medium text-sm">{item.title}</p>
                                            {item.estimated_time && (
                                              <p className="text-xs text-muted-foreground">
                                                {item.estimated_time} hours
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {item.status === 'completed' ? (
                                            <Badge variant="default" className="bg-green-600">
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
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No modules created yet</p>
                            )}

                            {/* Plan Actions */}
                            <div className="flex gap-2 pt-2">
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/admin/approve-plan/${plan.id}`}>
                                  <FileText className="mr-2 h-4 w-4" />
                                  View Plan Details
                                </Link>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

