"use client"

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import confetti from 'canvas-confetti'

export default function FinalQuizPage() {
  const router = useRouter()
  const params = useParams()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [plan, setPlan] = useState(null)
  const [assessment, setAssessment] = useState(null)
  const [answers, setAnswers] = useState({})
  const [showResults, setShowResults] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [quizScore, setQuizScore] = useState(null)
  const [quizPassed, setQuizPassed] = useState(false)

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

      setPlan(planData)

      // Check for existing assessment
      const { data: assessmentData } = await supabase
        .from('assessments')
        .select('*')
        .eq('learning_plan_id', params.id)
        .eq('assessment_type', 'final_quiz')
        .eq('learner_id', user.id)
        .single()

      if (assessmentData) {
        setAssessment(assessmentData)
        if (assessmentData.answers) {
          setAnswers(assessmentData.answers)
          setShowResults(true)
        }
        // Set score and passed status if they exist
        if (assessmentData.score !== null && assessmentData.score !== undefined) {
          setQuizScore(assessmentData.score)
          setQuizPassed(assessmentData.passed || false)
        }
      }
    } catch (error) {
      console.error('Error loading plan:', error)
      toast.error(error.message || 'Failed to load learning plan')
      router.push(`/learner/learn/${params.id}`)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateQuiz = async (isRetake = false) => {
    setGenerating(true)

    try {
      // If retaking, delete the old assessment first
      if (isRetake && assessment) {
        await supabase
          .from('assessments')
          .delete()
          .eq('id', assessment.id)
        
        // Reset state
        setAssessment(null)
        setAnswers({})
        setShowResults(false)
        setQuizScore(null)
        setQuizPassed(false)
      }

      // Get current session to include auth token
      const { data: { session } } = await supabase.auth.getSession()
      
      const headers = {
        'Content-Type': 'application/json'
      }
      
      // Add auth token if available
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch('/api/generate-assessment', {
        method: 'POST',
        headers,
        credentials: 'include', // Important: include cookies
        body: JSON.stringify({
          learningPlanId: params.id,
          assessmentType: 'final_quiz'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('API Error Response:', data)
        throw new Error(data.error || data.message || 'Failed to generate quiz')
      }

      setAssessment(data.assessment)
      toast.success(isRetake ? 'New quiz ready! Try again.' : 'Final quiz ready!')
    } catch (error) {
      console.error('Error generating quiz:', error)
      toast.error(error.message || 'Failed to generate quiz')
    } finally {
      setGenerating(false)
    }
  }

  const handleSubmitQuiz = async () => {
    if (!assessment) return

    setSubmitting(true)

    try {
      const questions = assessment.questions || []
      let correct = 0
      const results = {}

      questions.forEach((q, index) => {
        const userAnswer = answers[index]
        const isCorrect = userAnswer === q.correctAnswer
        if (isCorrect) correct++
        results[index] = {
          userAnswer,
          correctAnswer: q.correctAnswer,
          isCorrect,
          explanation: q.explanation
        }
      })

      const score = Math.round((correct / questions.length) * 100)
      const passed = score >= 10

      // Set score state immediately (before async database update)
      setQuizScore(score)
      setQuizPassed(passed)
      setShowResults(true)

      // Update local state
      setAssessment({
        ...assessment,
        score,
        passed,
        answers
      })
      console.log('Quiz updated:', { score, passed })

      // Update assessment in database
      const { data: updatedAssessment, error: updateError } = await supabase
        .from('assessments')
        .update({
          answers,
          score,
          passed,
          completed_at: new Date().toISOString()
        })
        .eq('id', assessment.id)
        .select()
        .single()

      if (updateError) {
        console.error('Database update error:', updateError)
        // Don't throw - we've already shown the score to the user
      }

      if (passed) {
        // Mark learning plan as completed
        await supabase
          .from('learning_plans')
          .update({
            status: 'completed'
          })
          .eq('id', params.id)

        confetti({
          particleCount: 200,
          spread: 100,
          origin: { y: 0.6 }
        })

        toast.success(`🎉 Congratulations! You completed the learning plan with ${score}%!`)
      } else {
        toast.error(`You scored ${score}%. You need 10% to pass. Please review and try again.`)
      }
    } catch (error) {
      console.error('Error submitting quiz:', error)
      // Even if there's an error, show the score if we calculated it
      if (quizScore === null) {
        toast.error('Failed to submit quiz')
      } else {
        toast.error('Failed to save quiz, but your score is displayed above')
      }
    } finally {
      setSubmitting(false)
    }
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

  const questions = assessment?.questions || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-teal-50 p-4 py-8">
      <div className="container mx-auto max-w-4xl space-y-6">
        <Link href={`/learner/learn/${params.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Learning Plan
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Final Quiz</CardTitle>
            <CardDescription>
              Complete this quiz to finish your learning plan: {plan.goals}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!assessment ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Ready to take the final quiz?</p>
                <Button
                  onClick={handleGenerateQuiz}
                  disabled={generating}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating quiz...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Generate & Start Quiz
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-6">
                  {questions.map((q, index) => (
                    <Card key={index}>
                      <CardContent className="p-4 space-y-3">
                        <p className="font-medium">{index + 1}. {q.question || `Question ${index + 1}`}</p>
                        {(q.type === 'multiple_choice' || (q.options && Array.isArray(q.options) && q.options.length > 0)) && q.options && q.options.length > 0 ? (
                          <div className="space-y-2">
                            {q.options.map((option, optIndex) => (
                              <label
                                key={optIndex}
                                className={`flex items-center space-x-2 p-2 rounded hover:bg-gray-50 cursor-pointer ${
                                  showResults && option === q.correctAnswer ? 'bg-green-100' : ''
                                } ${
                                  showResults && answers[index] === option && option !== q.correctAnswer ? 'bg-red-100' : ''
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
                                <span>{option}</span>
                                {showResults && option === q.correctAnswer && (
                                  <span className="ml-auto text-green-600 font-semibold">✓ Correct Answer</span>
                                )}
                              </label>
                            ))}
                          </div>
                        ) : q.type === 'true_false' ? (
                          <div className="space-y-2">
                            {['True', 'False'].map(option => (
                              <label
                                key={option}
                                className={`flex items-center space-x-2 p-2 rounded hover:bg-gray-50 cursor-pointer ${
                                  showResults && option === q.correctAnswer ? 'bg-green-100' : ''
                                } ${
                                  showResults && answers[index] === option && option !== q.correctAnswer ? 'bg-red-100' : ''
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
                                <span>{option}</span>
                                {showResults && option === q.correctAnswer && (
                                  <span className="ml-auto text-green-600 font-semibold">✓ Correct Answer</span>
                                )}
                              </label>
                            ))}
                          </div>
                        ) : q.options && q.options.length > 0 ? (
                          // Fallback: show options if they exist
                          <div className="space-y-2">
                            {q.options.map((option, optIndex) => (
                              <label
                                key={optIndex}
                                className={`flex items-center space-x-2 p-2 rounded hover:bg-gray-50 cursor-pointer ${
                                  showResults && option === q.correctAnswer ? 'bg-green-100' : ''
                                } ${
                                  showResults && answers[index] === option && option !== q.correctAnswer ? 'bg-red-100' : ''
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
                                <span>{option}</span>
                                {showResults && option === q.correctAnswer && (
                                  <span className="ml-auto text-green-600 font-semibold">✓ Correct Answer</span>
                                )}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-yellow-600">No options available for this question.</p>
                        )}
                        {q.type === 'short_answer' && (
                          <input
                            type="text"
                            value={answers[index] || ''}
                            onChange={(e) => setAnswers({ ...answers, [index]: e.target.value })}
                            disabled={showResults}
                            className="w-full p-2 border rounded"
                            placeholder="Your answer..."
                          />
                        )}
                        {showResults && (
                          <div className={`p-3 rounded ${
                            answers[index] === q.correctAnswer
                              ? 'bg-green-50 border border-green-200'
                              : 'bg-red-50 border border-red-200'
                          }`}>
                            <p className="text-sm font-medium mb-1">
                              {answers[index] === q.correctAnswer ? '✓ Correct' : '✗ Incorrect'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Correct answer: {q.correctAnswer}
                            </p>
                            {q.explanation && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {q.explanation}
                              </p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {!showResults && (
                  <Button
                    onClick={handleSubmitQuiz}
                    disabled={submitting || Object.keys(answers).length < questions.length}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Quiz'
                    )}
                  </Button>
                )}

                {showResults && (
                  <Card className={quizPassed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                    <CardContent className="p-6 text-center space-y-4">
                      <div>
                        <p className="text-2xl font-bold mb-2">
                          {quizScore !== null ? (
                            <>Score: {quizScore}%</>
                          ) : (
                            <>Calculating score...</>
                          )}
                        </p>
                        {quizScore !== null && (
                          <>
                            <p className="text-lg mb-2">
                              {quizPassed
                                ? '🎉 Congratulations! You passed the final quiz and completed your learning plan!'
                                : `You scored ${quizScore}%. You need 10% to pass. Please review the content and try again.`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {questions.filter((q, i) => answers[i] === q.correctAnswer).length} out of {questions.length} questions correct
                            </p>
                          </>
                        )}
                      </div>
                      {quizScore !== null && quizPassed ? (
                        <Link href="/learner/dashboard">
                          <Button className="bg-green-600 hover:bg-green-700">
                            Back to Dashboard
                          </Button>
                        </Link>
                      ) : quizScore !== null && !quizPassed ? (
                        <Button
                          onClick={() => handleGenerateQuiz(true)}
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
                              Retake Final Quiz
                            </>
                          )}
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

