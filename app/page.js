import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GraduationCap, Settings } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
            Learning Management System
          </h1>
          <p className="text-lg text-gray-700 mt-2">
            Select your role to continue
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Learner Card */}
          <Card className="hover:shadow-lg transition-all duration-300 border-2 hover:border-indigo-300">
            <CardHeader className="text-center pb-6">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <GraduationCap className="h-10 w-10 text-indigo-600" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold mb-2">Learner</CardTitle>
              <CardDescription className="text-base font-normal text-gray-600">
                Software Engineer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-6 pb-6">
              <p className="text-sm text-gray-600 text-center leading-relaxed">
                Access your profile, create learning plans, complete assessments, and track your progress.
              </p>
              <div className="pt-2">
                <Link href="/learner/login">
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-11 text-base font-medium">
                    Login as Learner
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Admin Card */}
          <Card className="hover:shadow-lg transition-all duration-300 border-2 hover:border-teal-300">
            <CardHeader className="text-center pb-6">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Settings className="h-10 w-10 text-purple-600" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold mb-2">Admin</CardTitle>
              <CardDescription className="text-base font-normal text-gray-600">
                Organizational Development
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-6 pb-6">
              <p className="text-sm text-gray-600 text-center leading-relaxed">
                Manage tech stacks, approve learning plans, track learner progress, and allocate rewards.
              </p>
              <div className="pt-2">
                <Link href="/admin/login">
                  <Button className="w-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 h-11 text-base font-medium">
                    Login as Admin
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

