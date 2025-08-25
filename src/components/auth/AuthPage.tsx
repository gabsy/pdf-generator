import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { AlertCircle, FileText, Clock } from 'lucide-react'

export function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimitEndTime, setRateLimitEndTime] = useState<number | null>(null)
  const [remainingTime, setRemainingTime] = useState<number>(0)

  // Update remaining time every second when rate limited
  useEffect(() => {
    if (!rateLimitEndTime) return

    const interval = setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, Math.ceil((rateLimitEndTime - now) / 1000))
      setRemainingTime(remaining)

      if (remaining === 0) {
        setRateLimitEndTime(null)
        setError(null)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [rateLimitEndTime])

  const handleRateLimitError = (errorMessage: string) => {
    // Extract the retry delay from the error message
    const match = errorMessage.match(/after (\d+) seconds?/)
    if (match) {
      const delaySeconds = parseInt(match[1], 10)
      const endTime = Date.now() + (delaySeconds * 1000)
      setRateLimitEndTime(endTime)
      setRemainingTime(delaySeconds)
      setError(`Rate limit exceeded. Please wait ${delaySeconds} seconds before trying again.`)
    } else {
      setError('Rate limit exceeded. Please wait a moment before trying again.')
    }
  }

  const handleAuthError = (error: any) => {
    if (error?.message?.includes('over_email_send_rate_limit')) {
      handleRateLimitError(error.message)
    } else {
      // Show user-friendly error message
      let errorMessage = 'An error occurred during sign in.';
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Please check your email and click the confirmation link before signing in.';
      } else if (error.message.includes('Too many requests')) {
        errorMessage = 'Too many login attempts. Please wait a few minutes before trying again.';
      }
      
      setError(errorMessage)
    }
  }

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (rateLimitEndTime && Date.now() < rateLimitEndTime) return
    
    setIsLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { error } = await signIn(email, password)
    
    if (error) {
      handleAuthError(error)
    }
    
    setIsLoading(false)
  }

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (rateLimitEndTime && Date.now() < rateLimitEndTime) return
    
    setIsLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    const { error } = await signUp(email, password)
    
    if (error) {
      handleAuthError(error)
    } else {
      setError('Account created successfully! You can now sign in.')
    }
    
    setIsLoading(false)
  }

  const isRateLimited = rateLimitEndTime && Date.now() < rateLimitEndTime
  const isButtonDisabled = isLoading || isRateLimited

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <FileText className="h-12 w-12 text-blue-600" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            PDF Generator
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to manage your PDF generation workflows
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              Sign in to your account or create a new one to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      required
                      placeholder="Enter your email"
                      disabled={isButtonDisabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      name="password"
                      type="password"
                      required
                      placeholder="Enter your password"
                      disabled={isButtonDisabled}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isButtonDisabled}>
                    {isLoading ? 'Signing in...' : 
                     isRateLimited ? `Wait ${remainingTime}s` : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      required
                      placeholder="Enter your email"
                      disabled={isButtonDisabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      required
                      placeholder="Create a password"
                      minLength={6}
                      disabled={isButtonDisabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">Confirm Password</Label>
                    <Input
                      id="signup-confirm"
                      name="confirmPassword"
                      type="password"
                      required
                      placeholder="Confirm your password"
                      minLength={6}
                      disabled={isButtonDisabled}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isButtonDisabled}>
                    {isLoading ? 'Creating account...' : 
                     isRateLimited ? `Wait ${remainingTime}s` : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {error && (
              <div className={`mt-4 flex items-center gap-2 p-3 border rounded-lg ${
                isRateLimited 
                  ? 'bg-yellow-50 border-yellow-200' 
                  : error.includes('Check your email') 
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
              }`}>
                {isRateLimited ? (
                  <Clock className="h-4 w-4 text-yellow-600" />
                ) : error.includes('Check your email') ? (
                  <AlertCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <p className={`text-sm ${
                  isRateLimited 
                    ? 'text-yellow-800' 
                    : error.includes('Check your email')
                      ? 'text-green-800'
                      : 'text-red-800'
                }`}>
                  {error}
                  {isRateLimited && remainingTime > 0 && (
                    <span className="font-medium"> ({remainingTime}s remaining)</span>
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}