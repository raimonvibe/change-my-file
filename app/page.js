'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, FileText, Image, Download, CheckCircle, XCircle, Clock, Zap, Shield, Globe } from 'lucide-react'
import { toast } from 'sonner'

export default function FileConversionApp() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [conversionType, setConversionType] = useState('')
  const [isConverting, setIsConverting] = useState(false)
  const [conversionProgress, setConversionProgress] = useState(0)
  const [conversionResult, setConversionResult] = useState(null)
  const [conversions, setConversions] = useState([])
  const [stats, setStats] = useState({ totalConversions: 0, stats: [] })

  // Fetch conversion history and stats
  useEffect(() => {
    fetchConversions()
    fetchStats()
  }, [])

  const fetchConversions = async () => {
    try {
      const response = await fetch('/api/conversions')
      const data = await response.json()
      setConversions(data.conversions || [])
    } catch (error) {
      console.error('Error fetching conversions:', error)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats')
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  // File upload handling
  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0]
    if (file) {
      setSelectedFile(file)
      setConversionResult(null)
      
      // Auto-suggest conversion type based on file extension
      const extension = file.name.toLowerCase().split('.').pop()
      if (extension === 'pdf') {
        setConversionType('pdf-to-txt')
      } else if (extension === 'docx') {
        setConversionType('docx-to-txt')
      } else if (extension === 'txt') {
        setConversionType('txt-to-pdf')
      }
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize: 50000000, // 50MB
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'application/msword': ['.doc']
    }
  })

  // File conversion
  const handleConversion = async () => {
    if (!selectedFile || !conversionType) {
      toast.error('Please select a file and conversion type')
      return
    }

    setIsConverting(true)
    setConversionProgress(0)

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setConversionProgress(prev => Math.min(prev + 10, 90))
    }, 300)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('conversionType', conversionType)
      formData.append('userId', 'anonymous') // Replace with actual user ID when auth is implemented

      const response = await fetch('/api/convert', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok) {
        setConversionProgress(100)
        setConversionResult(result)
        toast.success('File converted successfully!')
        fetchConversions() // Refresh history
        fetchStats() // Refresh stats
      } else {
        throw new Error(result.error || 'Conversion failed')
      }
    } catch (error) {
      console.error('Conversion error:', error)
      toast.error(error.message || 'Conversion failed')
    } finally {
      clearInterval(progressInterval)
      setIsConverting(false)
      setTimeout(() => setConversionProgress(0), 1000)
    }
  }

  // Download file
  const handleDownload = async (fileId, filename) => {
    try {
      // Update download count
      await fetch(`/api/conversions/${fileId}`, { method: 'PUT' })
      
      // Download file
      const response = await fetch(`/api/download/${fileId}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.style.display = 'none'
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        toast.success('Download started!')
      } else {
        throw new Error('Download failed')
      }
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Download failed')
    }
  }

  const conversionOptions = [
    { value: 'pdf-to-txt', label: 'PDF to Text', icon: FileText },
    { value: 'pdf-to-images', label: 'PDF to Images', icon: Image },
    { value: 'docx-to-txt', label: 'DOCX to Text', icon: FileText },
    { value: 'txt-to-pdf', label: 'Text to PDF', icon: FileText }
  ]

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />
      default: return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                FileConvert Hub
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary" className="hidden sm:flex">
                {stats.totalConversions} files converted
              </Badge>
              <Button variant="outline" size="sm">
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Convert Files Instantly
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Transform your documents, images, and files with our advanced conversion engine. 
            Fast, secure, and powered by cutting-edge technology.
          </p>
          
          {/* Feature highlights */}
          <div className="flex flex-wrap justify-center gap-6 mb-8">
            <div className="flex items-center space-x-2 text-gray-700">
              <Zap className="h-5 w-5 text-blue-500" />
              <span>Lightning Fast</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-700">
              <Shield className="h-5 w-5 text-green-500" />
              <span>100% Secure</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-700">
              <Globe className="h-5 w-5 text-purple-500" />
              <span>Cloud Powered</span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="convert" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="convert">Convert Files</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Convert Tab */}
          <TabsContent value="convert" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* File Upload */}
              <Card className="border-2 border-dashed border-gray-200 hover:border-blue-300 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Upload className="h-5 w-5" />
                    <span>Upload File</span>
                  </CardTitle>
                  <CardDescription>
                    Drag and drop your file here, or click to browse
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    {...getRootProps()}
                    className={`p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                      isDragActive 
                        ? 'border-blue-400 bg-blue-50' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    {selectedFile ? (
                      <div>
                        <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                        <p className="text-xs text-gray-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-gray-600">
                          {isDragActive ? 'Drop the file here' : 'Click or drag file to upload'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Supports PDF, DOCX, TXT files up to 50MB
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Conversion Options */}
              <Card>
                <CardHeader>
                  <CardTitle>Conversion Settings</CardTitle>
                  <CardDescription>
                    Choose your desired output format
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Conversion Type</label>
                    <Select value={conversionType} onValueChange={setConversionType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select conversion type" />
                      </SelectTrigger>
                      <SelectContent>
                        {conversionOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center space-x-2">
                              <option.icon className="h-4 w-4" />
                              <span>{option.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {isConverting && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Converting...</span>
                        <span>{conversionProgress}%</span>
                      </div>
                      <Progress value={conversionProgress} className="w-full" />
                    </div>
                  )}

                  <Button 
                    onClick={handleConversion}
                    disabled={!selectedFile || !conversionType || isConverting}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    {isConverting ? 'Converting...' : 'Convert File'}
                  </Button>

                  {conversionResult && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription className="flex items-center justify-between">
                        <span>Conversion completed successfully!</span>
                        <Button
                          size="sm"
                          onClick={() => handleDownload(conversionResult.fileId, conversionResult.outputFilename)}
                          className="ml-2"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Conversion History</CardTitle>
                <CardDescription>
                  Your recent file conversions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {conversions.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No conversions yet</p>
                  ) : (
                    conversions.map((conversion) => (
                      <div key={conversion.fileId} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(conversion.status)}
                          <div>
                            <p className="font-medium">{conversion.originalFilename}</p>
                            <p className="text-sm text-gray-500">
                              {conversion.conversionType} • {new Date(conversion.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {conversion.status === 'completed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(conversion.fileId, conversion.outputFilename)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Total Conversions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">
                    {stats.totalConversions}
                  </div>
                  <p className="text-sm text-gray-500">Files processed</p>
                </CardContent>
              </Card>

              {stats.stats.map((stat) => (
                <Card key={stat._id}>
                  <CardHeader>
                    <CardTitle className="text-sm">{stat._id}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {stat.count}
                    </div>
                    <p className="text-sm text-gray-500">Conversions</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}