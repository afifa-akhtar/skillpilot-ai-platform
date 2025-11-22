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

  // Auto-generate content when item is loaded and has no content
  useEffect(() => {
    if (item && !loading && !content && !generating) {
      console.log('Auto-generating content for item:', item.id)
      // Use a small delay to ensure state is properly set
      const timer = setTimeout(() => {
        handleGenerateContent()
      }, 500)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, loading, content, generating])

  // Check and hide unavailable YouTube videos
  useEffect(() => {
    if (!content) return

    const checkVideos = () => {
      const wrappers = document.querySelectorAll('.youtube-embed-wrapper')
      for (const wrapper of wrappers) {
        const videoId = wrapper.dataset.videoId
        if (videoId) {
          // Check thumbnail to determine if video is available
          const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
          const img = new Image()
          
          img.onload = () => {
            // YouTube's unavailable video thumbnails are typically 120x90 or 480x360 (default)
            // Available videos usually have larger thumbnails (1280x720 for maxresdefault)
            // If thumbnail is small, it's likely the default "unavailable" image
            if (img.naturalWidth <= 480 && img.naturalHeight <= 360) {
              wrapper.style.display = 'none'
              console.log(`Hiding unavailable video: ${videoId} (thumbnail size: ${img.naturalWidth}x${img.naturalHeight})`)
            }
          }
          
          img.onerror = () => {
            // Thumbnail doesn't exist, video is unavailable
            wrapper.style.display = 'none'
            console.log(`Hiding unavailable video (no thumbnail): ${videoId}`)
          }
          
          // Set timeout to hide if image doesn't load within reasonable time
          const timeout = setTimeout(() => {
            if (img.naturalWidth === 0 && img.naturalHeight === 0) {
              wrapper.style.display = 'none'
              console.log(`Hiding unavailable video (timeout): ${videoId}`)
            }
          }, 5000)
          
          img.src = thumbnailUrl
          
          // Clean up timeout when image loads
          img.addEventListener('load', () => clearTimeout(timeout), { once: true })
          img.addEventListener('error', () => clearTimeout(timeout), { once: true })
        }
      }
    }

    // Run check after content is rendered
    const timer = setTimeout(checkVideos, 2000)
    return () => clearTimeout(timer)
  }, [content])

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


  if (loading || (item && !content && generating)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-teal-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto" />
          <p className="text-lg font-medium text-gray-700">Generating learning content...</p>
          <p className="text-sm text-gray-500">This may take a few moments</p>
        </div>
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
    
    // First, handle YouTube links - convert to embedded players with error handling
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/gi
    formatted = formatted.replaceAll(youtubeRegex, (match, videoId) => {
      return `\n\n<div class="youtube-embed-wrapper my-6" data-video-id="${videoId}">
        <div class="youtube-embed-container relative w-full" style="padding-bottom: 56.25%; background: #000; border-radius: 0.5rem; overflow: hidden;">
          <iframe 
            id="yt-${videoId}"
            class="absolute top-0 left-0 w-full h-full"
            src="https://www.youtube.com/embed/${videoId}?enablejsapi=1" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowFullScreen
            onerror="this.parentElement.parentElement.style.display='none'"
            onload="
              try {
                const iframe = this;
                const checkVideo = setInterval(() => {
                  try {
                    if (iframe.contentWindow && iframe.contentWindow.location.href.includes('unavailable')) {
                      iframe.parentElement.parentElement.style.display='none';
                      clearInterval(checkVideo);
                    }
                  } catch(e) {}
                }, 1000);
                setTimeout(() => clearInterval(checkVideo), 5000);
              } catch(e) {}
            "
          ></iframe>
        </div>
      </div>\n\n`
    })
    
    // Handle YouTube links in markdown format [text](youtube_url)
    const youtubeMarkdownRegex = /\[([^\]]+)\]\((?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})\)/gi
    formatted = formatted.replaceAll(youtubeMarkdownRegex, (match, linkText, videoId) => {
      return `\n\n<div class="youtube-embed-wrapper my-6" data-video-id="${videoId}">
        <p class="text-sm font-medium text-gray-700 mb-3 text-gray-800">${linkText}</p>
        <div class="youtube-embed-container relative w-full" style="padding-bottom: 56.25%; background: #000; border-radius: 0.5rem; overflow: hidden;">
          <iframe 
            id="yt-${videoId}"
            class="absolute top-0 left-0 w-full h-full"
            src="https://www.youtube.com/embed/${videoId}?enablejsapi=1" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowFullScreen
            onerror="this.parentElement.parentElement.parentElement.style.display='none'"
            onload="
              try {
                const iframe = this;
                const checkVideo = setInterval(() => {
                  try {
                    if (iframe.contentWindow && iframe.contentWindow.location.href.includes('unavailable')) {
                      iframe.parentElement.parentElement.parentElement.style.display='none';
                      clearInterval(checkVideo);
                    }
                  } catch(e) {}
                }, 1000);
                setTimeout(() => clearInterval(checkVideo), 5000);
              } catch(e) {}
            "
          ></iframe>
        </div>
      </div>\n\n`
    })
    
    // Handle Udemy links - compact and clean
    const udemyRegex = /(https?:\/\/www\.udemy\.com\/course\/[^\s)]+)/gi
    formatted = formatted.replaceAll(udemyRegex, (url) => {
      const cleanUrl = url.replace(/[.,;!?]+$/, '')
      // Clean up course name - remove "Web Development Bootcamp" etc
      const courseName = cleanUrl.split('/').pop()?.replace(/-/g, ' ').replace(/\d+/g, '').replace(/web\s+development\s+bootcamp/gi, '').trim() || 'Udemy Course'
      return `<div class="udemy-link my-3 p-3 bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg flex items-center justify-center flex-shrink-0">
            <span class="text-white font-bold text-sm">U</span>
          </div>
          <div class="flex-1 min-w-0">
            <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-md transition-colors text-xs">
              <span>View on Udemy</span>
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      // Clean link text - remove common prefixes
      const cleanLinkText = linkText.replace(/^(web\s+)?development\s+bootcamp/gi, '').trim() || 'Udemy Course'
      return `<div class="udemy-link my-3 p-3 bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg flex items-center justify-center flex-shrink-0">
            <span class="text-white font-bold text-sm">U</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium text-gray-700 mb-1.5">${cleanLinkText}</p>
            <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-md transition-colors text-xs">
              <span>View Course</span>
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
              </svg>
            </a>
          </div>
        </div>
      </div>`
    })
    
    // Handle markdown links [text](url) for better display
    const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi
    formatted = formatted.replaceAll(markdownLinkRegex, (match, linkText, url) => {
      // Skip if already processed (YouTube or Udemy)
      const isVideoOrCourse = url.includes('youtube.com') || url.includes('youtu.be') || url.includes('udemy.com')
      if (isVideoOrCourse) {
        return match // Return original to be processed by specific handlers
      }
      
      const cleanUrl = url.replace(/[.,;!?]+$/, '')
      
      // Determine icon and styling based on URL type
      let icon = '🔗'
      let bgColor = 'bg-blue-50'
      let borderColor = 'border-blue-200'
      let buttonColor = 'bg-blue-600 hover:bg-blue-700'
      
      if (cleanUrl.includes('github.com')) {
        icon = '💻'
        bgColor = 'bg-gray-50'
        borderColor = 'border-gray-200'
        buttonColor = 'bg-gray-700 hover:bg-gray-800'
      } else if (cleanUrl.includes('developer.mozilla.org') || cleanUrl.includes('mdn')) {
        icon = '📘'
        bgColor = 'bg-indigo-50'
        borderColor = 'border-indigo-200'
        buttonColor = 'bg-indigo-600 hover:bg-indigo-700'
      } else if (cleanUrl.includes('nodejs.org') || cleanUrl.includes('docs')) {
        icon = '📚'
        bgColor = 'bg-green-50'
        borderColor = 'border-green-200'
        buttonColor = 'bg-green-600 hover:bg-green-700'
      }
      
      // Clean link text - remove common prefixes
      const cleanLinkText = linkText.replace(/^(web\s+)?development\s+bootcamp/gi, '').trim() || linkText
      
      return `<div class="resource-link my-2 p-2.5 ${bgColor} ${borderColor} border rounded-lg shadow-sm hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 flex-1 min-w-0">
            <span class="text-sm">${icon}</span>
            <span class="text-xs font-medium text-gray-700">${cleanLinkText}</span>
          </div>
          <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2.5 py-1 ${buttonColor} text-white font-medium rounded-md transition-colors text-xs whitespace-nowrap">
            <span>Visit</span>
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
            </svg>
          </a>
        </div>
      </div>`
    })
    
    // Detect and format other URLs (GitHub, documentation, etc.) with compact styling
    const urlRegex = /(https?:\/\/[^\s)]+|github\.com\/[^\s)]+|www\.[^\s)]+)/gi
    formatted = formatted.replaceAll(urlRegex, (url) => {
      // Skip if already processed (YouTube, Udemy, or markdown links)
      const isVideoOrCourse = url.includes('youtube.com') || url.includes('youtu.be') || url.includes('udemy.com')
      if (isVideoOrCourse) {
        return url
      }
      
      // Skip if it's part of a markdown link (already processed)
      if (formatted.includes(`href="${url}"`)) {
        return url
      }
      
      const cleanUrl = url.replace(/[.,;!?]+$/, '')
      
      // Determine icon and styling based on URL type
      let icon = '🔗'
      let label = 'Resource'
      let bgColor = 'bg-blue-50'
      let borderColor = 'border-blue-200'
      let buttonColor = 'bg-blue-600 hover:bg-blue-700'
      
      if (cleanUrl.includes('github.com')) {
        icon = '💻'
        label = 'GitHub'
        bgColor = 'bg-gray-50'
        borderColor = 'border-gray-200'
        buttonColor = 'bg-gray-700 hover:bg-gray-800'
      } else if (cleanUrl.includes('developer.mozilla.org') || cleanUrl.includes('mdn')) {
        icon = '📘'
        label = 'MDN Docs'
        bgColor = 'bg-indigo-50'
        borderColor = 'border-indigo-200'
        buttonColor = 'bg-indigo-600 hover:bg-indigo-700'
      } else if (cleanUrl.includes('nodejs.org') || cleanUrl.includes('docs')) {
        icon = '📚'
        label = 'Documentation'
        bgColor = 'bg-green-50'
        borderColor = 'border-green-200'
        buttonColor = 'bg-green-600 hover:bg-green-700'
      }
      
      return `<div class="resource-link my-2 p-2.5 ${bgColor} ${borderColor} border rounded-lg shadow-sm hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 flex-1 min-w-0">
            <span class="text-sm">${icon}</span>
            <span class="text-xs font-medium text-gray-700">${label}</span>
          </div>
          <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2.5 py-1 ${buttonColor} text-white font-medium rounded-md transition-colors text-xs whitespace-nowrap">
            <span>Visit</span>
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
            </svg>
          </a>
        </div>
      </div>`
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
                  className="learning-content text-base leading-relaxed"
                  dangerouslySetInnerHTML={{ 
                    __html: formatContent(content)
                      .replaceAll(/\n\n\n+/g, '\n\n')
                      .split('\n\n')
                      .map(para => {
                        if (!para.trim()) return ''
                        
                        // Check if it's a code block (triple backticks)
                        if (para.match(/^```[\s\S]*?```$/)) {
                          const codeMatch = para.match(/^```(\w+)?\n([\s\S]*?)```$/)
                          const language = codeMatch ? codeMatch[1] || '' : ''
                          const code = codeMatch ? codeMatch[2] : para.replace(/^```[\w]*\n?/, '').replace(/```$/, '')
                          return `<div class="my-6 rounded-lg overflow-hidden border border-gray-200 bg-gray-900">
                            ${language ? `<div class="px-4 py-2 bg-gray-800 text-gray-300 text-xs font-mono">${language}</div>` : ''}
                            <pre class="p-4 overflow-x-auto"><code class="text-sm text-gray-100 font-mono leading-relaxed">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
                          </div>`
                        }
                        
                        // Check if it's a list item
                        if (para.match(/^[\*\-\+]\s+/) || para.match(/^\d+\.\s+/)) {
                          const isOrdered = para.match(/^\d+\.\s+/)
                          const listItems = para.split(/\n(?=[\*\-\+]|\d+\.)/).filter(item => item.trim())
                          if (listItems.length > 0) {
                            const listTag = isOrdered ? 'ol' : 'ul'
                            const listClass = isOrdered ? 'list-decimal list-inside' : 'list-disc list-inside'
                            return `<${listTag} class="${listClass} space-y-2 my-4 text-gray-700 pl-6">
                              ${listItems.map(item => {
                                const cleanItem = item.replace(/^[\*\-\+]\s+/, '').replace(/^\d+\.\s+/, '')
                                const formattedItem = cleanItem
                                  .replaceAll(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
                                  .replaceAll(/\*(.*?)\*/g, '<em class="italic text-gray-800">$1</em>')
                                  .replaceAll(/`([^`]+)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-indigo-700">$1</code>')
                                return `<li class="leading-7">${formattedItem}</li>`
                              }).join('')}
                            </${listTag}>`
                          }
                        }
                        
                        // Check if it's a heading
                        if (para.match(/^###\s+/)) {
                          return `<h3 class="text-xl font-semibold mt-8 mb-4 text-gray-900 leading-tight">${para.replace(/^###\s+/, '')}</h3>`
                        }
                        if (para.match(/^##\s+/)) {
                          return `<h2 class="text-2xl font-bold mt-10 mb-5 text-gray-900 leading-tight">${para.replace(/^##\s+/, '')}</h2>`
                        }
                        if (para.match(/^#\s+/)) {
                          return `<h1 class="text-3xl font-bold mt-12 mb-6 text-gray-900 leading-tight">${para.replace(/^#\s+/, '')}</h1>`
                        }
                        
                        // Regular paragraph with improved styling
                        let formattedPara = para
                          .replaceAll(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
                          .replaceAll(/\*(.*?)\*/g, '<em class="italic text-gray-800">$1</em>')
                          .replaceAll(/`([^`]+)`/g, '<code class="bg-indigo-50 border border-indigo-200 px-2 py-1 rounded text-sm font-mono text-indigo-800">$1</code>')
                        
                        // Check if paragraph contains section headers like "Additional Learning Resources"
                        if (para.match(/additional.*learning.*resource/i) || (para.match(/^[A-Z][^.!?]*resource/i) && para.length < 50)) {
                          const headerText = para.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim()
                          return `<div class="my-8 p-5 bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 border-l-4 border-indigo-500 rounded-r-lg shadow-sm">
                            <h3 class="text-xl font-bold text-gray-900 mb-0">${headerText}</h3>
                          </div>`
                        }
                        
                        return `<p class="mb-5 text-gray-700 leading-7 text-[15px]">${formattedPara}</p>`
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

