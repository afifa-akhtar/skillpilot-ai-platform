"use client"

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, CheckCircle, FileText } from 'lucide-react'
import Link from 'next/link'
import confetti from 'canvas-confetti'

export default function AssessmentPage() {
  const router = useRouter()
  const params = useParams()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [item, setItem] = useState(null)
  const [assessment, setAssessment] = useState(null)
  const [answers, setAnswers] = useState({})
  const [showResults, setShowResults] = useState(false)
  const [assessmentScore, setAssessmentScore] = useState(null)
  const [assessmentPassed, setAssessmentPassed] = useState(false)

  useEffect(() => {
    loadAssessment()
  }, [params.itemId])

  const loadAssessment = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/learner/login')
        return
      }

      // Load learning item
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

      setItem(itemData)

      // Check for existing assessment
      const { data: assessmentData } = await supabase
        .from('assessments')
        .select('*')
        .eq('learning_item_id', params.itemId)
        .eq('learner_id', user.id)
        .single()

      if (assessmentData) {
        setAssessment(assessmentData)
        if (assessmentData.answers) {
          setAnswers(assessmentData.answers)
          setShowResults(true)
        }
        if (assessmentData.score !== null && assessmentData.score !== undefined) {
          setAssessmentScore(assessmentData.score)
          setAssessmentPassed(assessmentData.passed || false)
        }
      }
    } catch (error) {
      console.error('Error loading assessment:', error)
      toast.error(error.message || 'Failed to load assessment')
      router.push(`/learner/learn/${params.id}/item/${params.itemId}`)
    } finally {
      setLoading(false)
    }
  }

  const handleStartAssessment = async (isRetake = false) => {
    setGenerating(true)

    try {
      // If retaking, delete the old assessment first
      if (isRetake && assessment) {
        await supabase
          .from('assessments')
          .delete()
          .eq('id', assessment.id)
        
        setAssessment(null)
        setAnswers({})
        setShowResults(false)
        setAssessmentScore(null)
        setAssessmentPassed(false)
      }

      // Get current session to include auth token
      const { data: { session } } = await supabase.auth.getSession()
      
      const headers = {
        'Content-Type': 'application/json'
      }
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch('/api/generate-assessment', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          learningItemId: params.itemId,
          assessmentType: 'learning_item'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to generate assessment')
      }

      setAssessment(data.assessment)
      toast.success(isRetake ? 'New assessment ready! Try again.' : 'Assessment ready!')
    } catch (error) {
      console.error('Error generating assessment:', error)
      toast.error(error.message || 'Failed to generate assessment')
    } finally {
      setGenerating(false)
    }
  }

  const handleSubmitAssessment = async () => {
    if (!assessment) return

    try {
      const questions = assessment.questions || []
      let correct = 0

      for (const [index, q] of questions.entries()) {
        const userAnswer = answers[index]
        const isCorrect = userAnswer === q.correctAnswer
        if (isCorrect) correct++
      }

      const score = Math.round((correct / questions.length) * 100)
      const passed = score >= 30

      // Set score state immediately
      setAssessmentScore(score)
      setAssessmentPassed(passed)
      setShowResults(true)

      // Update assessment in database
      await supabase
        .from('assessments')
        .update({
          answers,
          score,
          passed,
          completed_at: new Date().toISOString()
        })
        .eq('id', assessment.id)

      if (passed) {
        // Mark learning item as completed
        await supabase
          .from('learning_items')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', params.itemId)

        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        })

        toast.success(`Congratulations! You passed with ${score}%`)
      } else {
        toast.error(`You scored ${score}%. You need 30% to pass.`)
      }
    } catch (error) {
      console.error('Error submitting assessment:', error)
      if (assessmentScore === null) {
        toast.error('Failed to submit assessment')
      } else {
        toast.error('Failed to save assessment, but your score is displayed above')
      }
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

  const questions = assessment?.questions || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-teal-50 p-4 py-8">
      <div className="container mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <Link href={`/learner/learn/${params.id}/item/${params.itemId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Module
            </Button>
          </Link>
          <Link href={`/learner/learn/${params.id}`}>
            <Button variant="ghost" size="sm">
              Back to Learning Plan
            </Button>
          </Link>
        </div>

        <Card className="border-t-4 border-t-indigo-600">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Module Assessment: {item.title}
            </CardTitle>
            <CardDescription>
              Complete the assessment below to finish this module. You need 30% to pass.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!assessment ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-6">No assessment available yet</p>
                <Button
                  onClick={handleStartAssessment}
                  disabled={generating}
                  className="bg-teal-500 hover:bg-teal-600"
                  size="lg"
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating assessment...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Start Assessment
                    </>
                  )}
                </Button>
              </div>
            ) : questions.length > 0 ? (
              <div className="space-y-6">
                {questions.map((q, index) => {
                  const questionOptions = q.options && q.options.length >= 2 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D']
                  
                  return (
                    <Card key={`question-${index}`}>
                      <CardContent className="p-4 space-y-3">
                        <p className="font-medium text-lg">{index + 1}. {q.question || `Question ${index + 1}`}</p>
                        <div className="space-y-2">
                          {questionOptions.map((option, optIndex) => (
                            <label
                              key={`option-${optIndex}`}
                              className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors cursor-pointer ${
                                showResults && option === q.correctAnswer 
                                  ? 'bg-green-100 border-green-300' 
                                  : showResults && answers[index] === option && option !== q.correctAnswer
                                  ? 'bg-red-100 border-red-300'
                                  : 'bg-white border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`question-${index}`}
                                value={option}
                                checked={answers[index] === option}
                                onChange={() => setAnswers({ ...answers, [index]: option })}
                                disabled={showResults}
                                className="cursor-pointer"
                              />
                              <span className="flex-1">{option}</span>
                              {showResults && option === q.correctAnswer && (
                                <span className="text-green-600 font-semibold">✓ Correct Answer</span>
                              )}
                            </label>
                          ))}
                        </div>
                        {showResults && (
                          <div className={`p-4 rounded-lg mt-3 ${
                            answers[index] === q.correctAnswer
                              ? 'bg-green-50 border border-green-200'
                              : 'bg-red-50 border border-red-200'
                          }`}>
                            <p className="text-sm font-medium mb-2">
                              {answers[index] === q.correctAnswer ? '✓ Correct' : '✗ Incorrect'}
                            </p>
                            {answers[index] !== q.correctAnswer && (
                              <p className="text-sm text-muted-foreground mb-1">
                                Your answer: <strong>{answers[index] || 'Not answered'}</strong>
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground mb-1">
                              Correct answer: <strong>{q.correctAnswer || 'Not specified'}</strong>
                            </p>
                            {q.explanation && (
                              <p className="text-sm text-muted-foreground mt-2">
                                <strong>Explanation:</strong> {q.explanation}
                              </p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
                {!showResults && (
                  <Button
                    onClick={handleSubmitAssessment}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                    size="lg"
                  >
                    Submit Assessment
                  </Button>
                )}
                {showResults && (
                  <Card className={assessmentPassed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                    <CardContent className="p-6 text-center space-y-4">
                      <div>
                        <p className="text-3xl font-bold mb-2">
                          {assessmentScore !== null ? (
                            <>Score: {assessmentScore}%</>
                          ) : (
                            <>Calculating score...</>
                          )}
                        </p>
                        {assessmentScore !== null && (
                          <>
                            <p className="text-base mb-2">
                              {assessmentPassed
                                ? '✅ Congratulations! You passed the assessment.'
                                : `❌ You scored ${assessmentScore}%. You need 30% to pass. Please review the content and try again.`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {questions.filter((q, i) => answers[i] === q.correctAnswer).length} out of {questions.length} questions correct
                            </p>
                          </>
                        )}
                      </div>
                      {assessmentScore !== null && !assessmentPassed && (
                        <Button
                          onClick={() => handleStartAssessment(true)}
                          disabled={generating}
                          className="bg-indigo-600 hover:bg-indigo-700"
                        >
                          {generating ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Retake Assessment
                            </>
                          )}
                        </Button>
                      )}
                      {assessmentPassed && (
                        <Link href={`/learner/learn/${params.id}`}>
                          <Button className="bg-green-600 hover:bg-green-700">
                            Continue to Next Module
                          </Button>
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Assessment is being generated...</p>
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

