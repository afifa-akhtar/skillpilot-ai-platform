"use client"

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, CheckCircle, Sparkles, FileText } from 'lucide-react'
import Link from 'next/link'

export default function LearningItemPage() {
  const router = useRouter()
  const params = useParams()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [item, setItem] = useState(null)
  const [content, setContent] = useState('')
  const [assessment, setAssessment] = useState(null)
  const [hasReadContent, setHasReadContent] = useState(false)

  useEffect(() => {
    loadItem()
  }, [params.itemId])

  const loadItem = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/learner/login')
        return
      }

      const { data: itemData, error: itemError } = await supabase
        .from('learning_items')
        .select(`
          *,
          learning_plans!inner (
            id,
            learner_id
          )
        `)
        .eq('id', params.itemId)
        .single()

      if (itemError || !itemData) {
        throw new Error('Learning item not found')
      }

      if (itemData.learning_plans.learner_id !== user.id) {
        throw new Error('Unauthorized')
      }

      // Check if previous module is completed
      const { data: allItems } = await supabase
        .from('learning_items')
        .select('*')
        .eq('learning_plan_id', itemData.learning_plans.id)
        .order('order_index')

      if (allItems && allItems.length > 0) {
        const currentIndex = allItems.findIndex(item => item.id === itemData.id)
        
        // If not the first module, check if previous is completed
        if (currentIndex > 0) {
          const previousItem = allItems[currentIndex - 1]
          if (previousItem.status !== 'completed') {
            const previousModuleName = previousItem.title || `Module ${currentIndex}`
            toast.error(`Please complete "${previousModuleName}" before starting this module`)
            router.push(`/learner/learn/${itemData.learning_plans.id}`)
            return
          }
        }
      }

      setItem(itemData)
      setContent(itemData.content || '')
      
      // Check if content exists and has been viewed
      if (itemData.content && itemData.content.length > 0) {
        setHasReadContent(true)
      }

      // Mark as in progress if not started
      if (itemData.status === 'not_started') {
        await supabase
          .from('learning_items')
          .update({
            status: 'in_progress',
            started_at: new Date().toISOString()
          })
          .eq('id', params.itemId)
      }

      // Check for existing assessment
      const { data: assessmentData } = await supabase
        .from('assessments')
        .select('*')
        .eq('learning_item_id', params.itemId)
        .eq('learner_id', user.id)
        .single()

      if (assessmentData) {
        setAssessment(assessmentData)
      }
    } catch (error) {
      console.error('Error loading item:', error)
      toast.error(error.message || 'Failed to load learning item')
      router.push(`/learner/learn/${params.id}`)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateContent = async () => {
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

      const response = await fetch('/api/generate-content', {
        method: 'POST',
        headers,
        credentials: 'include', // Important: include cookies
        body: JSON.stringify({ learningItemId: params.itemId })
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('API Error Response:', data)
        throw new Error(data.error || data.message || 'Failed to generate content')
      }

      setContent(data.content)
      setHasReadContent(true)
      toast.success('Learning content generated!')
    } catch (error) {
      console.error('Error generating content:', error)
      const errorMessage = error.message || error.toString() || 'Failed to generate content'
      toast.error(errorMessage)
      console.error('Full error:', error)
    } finally {
      setGenerating(false)
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!item) {
    return null
  }

  // Function to format content with proper link rendering and video embeds
  const formatContent = (text) => {
    if (!text) return ''
    
    let formatted = text
    
    // First, handle YouTube links - convert to embedded players
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/gi
    formatted = formatted.replaceAll(youtubeRegex, (match, videoId) => {
      return `\n\n<div class="youtube-embed my-6">
        <iframe 
          width="100%" 
          height="400" 
          src="https://www.youtube.com/embed/${videoId}" 
          frameBorder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowFullScreen
          className="rounded-lg shadow-lg"
        ></iframe>
      </div>\n\n`
    })
    
    // Handle YouTube links in markdown format [text](youtube_url)
    const youtubeMarkdownRegex = /\[([^\]]+)\]\((?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})\)/gi
    formatted = formatted.replaceAll(youtubeMarkdownRegex, (match, linkText, videoId) => {
      return `\n\n<div class="youtube-embed my-6">
        <p class="text-sm font-medium text-gray-700 mb-2">${linkText}</p>
        <iframe 
          width="100%" 
          height="400" 
          src="https://www.youtube.com/embed/${videoId}" 
          frameBorder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowFullScreen
          className="rounded-lg shadow-lg"
        ></iframe>
      </div>\n\n`
    })
    
    // Handle Udemy links - make them prominent
    const udemyRegex = /(https?:\/\/www\.udemy\.com\/course\/[^\s)]+)/gi
    formatted = formatted.replaceAll(udemyRegex, (url) => {
      const cleanUrl = url.replace(/[.,;!?]+$/, '')
      return `<div class="udemy-link my-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
            <span class="text-white font-bold">U</span>
          </div>
          <div class="flex-1">
            <p class="font-semibold text-gray-900 mb-1">Udemy Course</p>
            <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-purple-600 hover:text-purple-800 hover:underline font-medium text-sm break-all">
              ${cleanUrl}
              <svg class="w-4 h-4 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
              </svg>
            </a>
          </div>
        </div>
      </div>`
    })
    
    // Handle Udemy links in markdown format [text](udemy_url)
    const udemyMarkdownRegex = /\[([^\]]+)\]\((https?:\/\/www\.udemy\.com\/course\/[^\s)]+)\)/gi
    formatted = formatted.replaceAll(udemyMarkdownRegex, (match, linkText, url) => {
      const cleanUrl = url.replace(/[.,;!?]+$/, '')
      return `<div class="udemy-link my-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
            <span class="text-white font-bold">U</span>
          </div>
          <div class="flex-1">
            <p class="font-semibold text-gray-900 mb-1">${linkText}</p>
            <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-purple-600 hover:text-purple-800 hover:underline font-medium text-sm break-all">
              View Course on Udemy
              <svg class="w-4 h-4 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
              </svg>
            </a>
          </div>
        </div>
      </div>`
    })
    
    // Detect and format other URLs (GitHub, documentation, etc.)
    const urlRegex = /(https?:\/\/[^\s)]+|github\.com\/[^\s)]+|www\.[^\s)]+)/gi
    formatted = formatted.replaceAll(urlRegex, (url) => {
      // Skip if already processed (YouTube or Udemy)
      const isVideoOrCourse = url.includes('youtube.com') || url.includes('youtu.be') || url.includes('udemy.com')
      if (isVideoOrCourse) {
        return url
      }
      
      const cleanUrl = url.replace(/[.,;!?]+$/, '')
      const displayUrl = cleanUrl.length > 50 ? `${cleanUrl.substring(0, 50)}...` : cleanUrl
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-800 hover:underline font-medium inline-flex items-center gap-1 break-all">🔗 ${displayUrl} <svg class="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a>`
    })
    
    return formatted
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-teal-50 p-4 py-8">
      <div className="container mx-auto max-w-4xl space-y-6">
        <Link href={`/learner/learn/${params.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Learning Plan
          </Button>
        </Link>

        {/* Learning Content Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{item.title}</CardTitle>
            <CardDescription>{item.objectives}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {content ? (
              <div className="prose prose-slate max-w-none">
                <div 
                  className="text-base leading-relaxed space-y-4"
                  dangerouslySetInnerHTML={{ 
                    __html: formatContent(content)
                      .replaceAll(/\n\n\n+/g, '\n\n')
                      .split('\n\n')
                      .map(para => {
                        if (!para.trim()) return ''
                        // Check if it's a heading
                        if (para.match(/^###\s+/)) {
                          return `<h3 class="text-xl font-semibold mt-6 mb-3 text-gray-900">${para.replace(/^###\s+/, '')}</h3>`
                        }
                        if (para.match(/^##\s+/)) {
                          return `<h2 class="text-2xl font-bold mt-8 mb-4 text-gray-900">${para.replace(/^##\s+/, '')}</h2>`
                        }
                        if (para.match(/^#\s+/)) {
                          return `<h1 class="text-3xl font-bold mt-8 mb-4 text-gray-900">${para.replace(/^#\s+/, '')}</h1>`
                        }
                        // Regular paragraph
                        let formattedPara = para
                          .replaceAll(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
                          .replaceAll(/\*(.*?)\*/g, '<em class="italic">$1</em>')
                          .replaceAll(/`([^`]+)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-indigo-700">$1</code>')
                        return `<p class="mb-4 text-gray-700">${formattedPara}</p>`
                      })
                      .join('')
                  }}
                />
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No learning content yet</p>
                <Button
                  onClick={handleGenerateContent}
                  disabled={generating}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating content...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Learning Content
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assessment Section - Link to separate page */}
        {hasReadContent && (
          <Card className="border-t-4 border-t-teal-500">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Module Assessment
              </CardTitle>
              <CardDescription>
                Complete the assessment to finish this module
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/learner/learn/${params.id}/item/${params.itemId}/assessment`}>
                <Button className="w-full bg-teal-500 hover:bg-teal-600" size="lg">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {assessment ? 'View Assessment' : 'Start Assessment'}
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

