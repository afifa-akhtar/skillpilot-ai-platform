"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'

export default function LearnerProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [techStacks, setTechStacks] = useState([])
  const [selectedTechStacks, setSelectedTechStacks] = useState([])
  const [formData, setFormData] = useState({
    roleDesignation: '',
    totalExperience: '',
    strengths: '',
    improvementAreas: ''
  })

  useEffect(() => {
    loadTechStacks()
    loadExistingProfile()
  }, [])

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
      toast.error('Failed to load tech stacks')
    }
  }

  const loadExistingProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile, error } = await supabase
        .from('learner_profiles')
        .select(`
          *,
          learner_tech_stacks (
            *,
            tech_stacks (*)
          )
        `)
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (profile) {
        setFormData({
          roleDesignation: profile.role_designation || '',
          totalExperience: profile.total_experience || '',
          strengths: profile.strengths || '',
          improvementAreas: profile.improvement_areas || ''
        })

        const techStackData = profile.learner_tech_stacks.map(lt => ({
          techStackId: lt.tech_stack_id,
          techStackName: lt.tech_stacks.name,
          proficiency: lt.proficiency,
          yearsOfExperience: lt.years_of_experience
        }))
        setSelectedTechStacks(techStackData)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    }
  }

  const handleAddTechStack = (techStackId) => {
    const techStack = techStacks.find(ts => ts.id === techStackId)
    if (!techStack) return

    if (selectedTechStacks.find(st => st.techStackId === techStackId)) {
      toast.error('This tech stack is already added')
      return
    }

    setSelectedTechStacks([...selectedTechStacks, {
      techStackId,
      techStackName: techStack.name,
      proficiency: 'Beginner',
      yearsOfExperience: 0
    }])
  }

  const handleRemoveTechStack = (techStackId) => {
    setSelectedTechStacks(selectedTechStacks.filter(st => st.techStackId !== techStackId))
  }

  const handleUpdateTechStack = (techStackId, field, value) => {
    setSelectedTechStacks(selectedTechStacks.map(st =>
      st.techStackId === techStackId ? { ...st, [field]: value } : st
    ))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Please log in')
        router.push('/learner/login')
        return
      }

      // Create or update profile
      const { data: profile, error: profileError } = await supabase
        .from('learner_profiles')
        .upsert({
          user_id: user.id,
          role_designation: formData.roleDesignation,
          total_experience: parseInt(formData.totalExperience) || 0,
          strengths: formData.strengths,
          improvement_areas: formData.improvementAreas,
          is_complete: true
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single()

      if (profileError) throw profileError

      // Delete existing tech stacks
      await supabase
        .from('learner_tech_stacks')
        .delete()
        .eq('profile_id', profile.id)

      // Insert new tech stacks
      if (selectedTechStacks.length > 0) {
        const techStackInserts = selectedTechStacks.map(st => ({
          profile_id: profile.id,
          tech_stack_id: st.techStackId,
          proficiency: st.proficiency,
          years_of_experience: parseInt(st.yearsOfExperience) || 0
        }))

        const { error: techStackError } = await supabase
          .from('learner_tech_stacks')
          .insert(techStackInserts)

        if (techStackError) throw techStackError
      }

      toast.success('Profile saved successfully!')
      router.push('/learner/dashboard')
    } catch (error) {
      console.error('Error saving profile:', error)
      toast.error(error.message || 'Failed to save profile')
    } finally {
      setLoading(false)
    }
  }

  const availableTechStacks = techStacks.filter(ts =>
    !selectedTechStacks.find(st => st.techStackId === ts.id)
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-teal-50 p-4 py-8">
      <div className="container mx-auto max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Your Profile</CardTitle>
            <CardDescription>
              Update your profile information. This helps us create personalized learning paths for you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="roleDesignation">Role/Designation *</Label>
                <Input
                  id="roleDesignation"
                  placeholder="e.g., Senior Software Engineer, Full Stack Developer"
                  value={formData.roleDesignation}
                  onChange={(e) => setFormData({ ...formData, roleDesignation: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalExperience">Total Experience (Years) *</Label>
                <Input
                  id="totalExperience"
                  type="number"
                  min="0"
                  placeholder="e.g., 5"
                  value={formData.totalExperience}
                  onChange={(e) => setFormData({ ...formData, totalExperience: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="strengths">Strengths *</Label>
                <Textarea
                  id="strengths"
                  placeholder="Describe your key strengths and skills..."
                  value={formData.strengths}
                  onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="improvementAreas">Improvement Areas (Weaknesses) *</Label>
                <Textarea
                  id="improvementAreas"
                  placeholder="Describe areas where you'd like to improve..."
                  value={formData.improvementAreas}
                  onChange={(e) => setFormData({ ...formData, improvementAreas: e.target.value })}
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-4">
                <Label>Tech Stacks *</Label>
                <p className="text-sm text-muted-foreground">
                  Select tech stacks you are familiar with and provide your proficiency level
                </p>

                {techStacks.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No tech stacks available. Please ask an admin to add tech stacks.
                  </p>
                )}

                {availableTechStacks.length > 0 && (
                  <Select onValueChange={handleAddTechStack}>
                    <SelectTrigger>
                      <SelectValue placeholder="Add a tech stack" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTechStacks.map(ts => (
                        <SelectItem key={ts.id} value={ts.id}>
                          {ts.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="space-y-3">
                  {selectedTechStacks.map(st => (
                    <Card key={st.techStackId} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <Badge variant="secondary" className="text-sm">
                          {st.techStackName}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveTechStack(st.techStackId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Proficiency</Label>
                          <Select
                            value={st.proficiency}
                            onValueChange={(value) => handleUpdateTechStack(st.techStackId, 'proficiency', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Beginner">Beginner</SelectItem>
                              <SelectItem value="Intermediate">Intermediate</SelectItem>
                              <SelectItem value="Advanced">Advanced</SelectItem>
                              <SelectItem value="Expert">Expert</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Years of Experience</Label>
                          <Input
                            type="number"
                            min="0"
                            value={st.yearsOfExperience}
                            onChange={(e) => handleUpdateTechStack(st.techStackId, 'yearsOfExperience', e.target.value)}
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700"
                  disabled={loading || selectedTechStacks.length === 0}
                >
                  {loading ? 'Saving...' : 'Save Profile'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/learner/dashboard')}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

