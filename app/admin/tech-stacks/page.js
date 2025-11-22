"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function TechStacksPage() {
  const router = useRouter()
  const [techStacks, setTechStacks] = useState([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })

  useEffect(() => {
    loadTechStacks()
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Please log in')
        return
      }

      const { error } = await supabase
        .from('tech_stacks')
        .insert({
          name: formData.name,
          description: formData.description,
          created_by: user.id
        })

      if (error) throw error

      toast.success('Tech stack added successfully!')
      setFormData({ name: '', description: '' })
      setDialogOpen(false)
      loadTechStacks()
    } catch (error) {
      console.error('Error adding tech stack:', error)
      toast.error(error.message || 'Failed to add tech stack')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this tech stack?')) return

    try {
      const { error } = await supabase
        .from('tech_stacks')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Tech stack deleted successfully!')
      loadTechStacks()
    } catch (error) {
      console.error('Error deleting tech stack:', error)
      toast.error(error.message || 'Failed to delete tech stack')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-teal-50 p-4 py-8">
      <div className="container mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Manage Tech Stacks</CardTitle>
                <CardDescription>
                  Configure tech stacks that learners can select in their profiles
                </CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-teal-500 hover:bg-teal-600">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Tech Stack
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Tech Stack</DialogTitle>
                    <DialogDescription>
                      Add a new technology stack that learners can use in their profiles
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        placeholder="e.g., Node.js, React, MySQL"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Optional description..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={loading} className="bg-teal-500 hover:bg-teal-600">
                        {loading ? 'Adding...' : 'Add Tech Stack'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {techStacks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No tech stacks yet</p>
                <Button onClick={() => setDialogOpen(true)} className="bg-teal-500 hover:bg-teal-600">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Tech Stack
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {techStacks.map(ts => (
                  <Card key={ts.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{ts.name}</h3>
                          {ts.description && (
                            <p className="text-sm text-muted-foreground mt-1">{ts.description}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(ts.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

