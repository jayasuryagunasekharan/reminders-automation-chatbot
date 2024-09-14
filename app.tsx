import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form"
import { useForm } from "react-hook-form"
import { addReminder, updateReminder, deleteReminder, getReminders } from '@/lib/calendarApi'
import { getAIResponse } from '@/lib/aiApi'
import { addEvent, updateEvent, deleteEvent, getEvents } from '@/lib/googleCalendarApi'
import { processNaturalLanguage } from '@/lib/nlpProcessor'
import natural from 'natural'

const tokenizer = new natural.WordTokenizer()
const dateParser = new natural.DateParse()

export function processNaturalLanguage(text) {
  const tokens = tokenizer.tokenize(text.toLowerCase())
  const date = dateParser.parse(text)

  let time = '12:00' // Default time
  const timeRegex = /(\d{1,2}):(\d{2})/
  const timeMatch = text.match(timeRegex)
  if (timeMatch) {
    time = timeMatch[0]
  }

  return {
    date: date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    time: time,
    text: text,
  }
}

export default function VoiceCalendarAssistant() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [reminders, setReminders] = useState([])
  const [aiResponse, setAiResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const recognitionRef = useRef(null)
  const form = useForm()
  const [events, setEvents] = useState([])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      recognitionRef.current = new (window.SpeechRecognition || window.webkitSpeechRecognition)()
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true

      recognitionRef.current.onresult = (event) => {
        const current = event.resultIndex
        const transcript = event.results[current][0].transcript
        setTranscript(transcript)
      }
    }

    loadReminders()

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.code === 'Space') {
        toggleListening()
      }
    }

    window.addEventListener('keydown', handleKeyPress)

    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [isListening])

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current.stop()
    } else {
      recognitionRef.current.start()
    }
    setIsListening(!isListening)
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      // Process the transcript with NLP
      const { date, time, text } = await processNaturalLanguage(transcript)
      
      // Add event to Google Calendar
      await addEvent({ date, time, text })
      
      // Get AI response
      const aiResp = await getAIResponse(transcript)
      setAiResponse(aiResp)
      
      // Reload events
      await loadEvents()
      
      setTranscript('')
    } catch (error) {
      console.error('Error processing request:', error)
      setAiResponse('Sorry, there was an error processing your request.')
    } finally {
      setIsLoading(false)
    }
  }

  const loadReminders = async () => {
    const fetchedReminders = await getReminders()
    setReminders(fetchedReminders)
  }

  const handleUpdateReminder = async (id, data) => {
    await updateReminder(id, data)
    await loadReminders()
  }

  const handleDeleteReminder = async (id) => {
    await deleteReminder(id)
    await loadReminders()
  }

  const loadEvents = async () => {
    const fetchedEvents = await getEvents()
    setEvents(fetchedEvents)
  }

  const handleUpdateEvent = async (id, data) => {
    await updateEvent(id, data)
    await loadEvents()
  }

  const handleDeleteEvent = async (id) => {
    await deleteEvent(id)
    await loadEvents()
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Voice Calendar Assistant</h1>
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Voice Input</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={toggleListening} className="mb-2">
              {isListening ? 'Stop Listening' : 'Start Listening'}
            </Button>
            <Input value={transcript} onChange={(e) => setTranscript(e.target.value)} className="mb-2" />
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? 'Processing...' : 'Submit'}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar 
              selected={selectedDate}
              onSelect={setSelectedDate}
              mode="single"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Reminders</CardTitle>
          </CardHeader>
          <CardContent>
            <ul>
              {reminders.map((reminder) => (
                <li key={reminder.id} className="mb-2">
                  {reminder.text}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="ml-2">Edit</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Reminder</DialogTitle>
                      </DialogHeader>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit((data) => handleUpdateReminder(reminder.id, data))}>
                          <FormField
                            control={form.control}
                            name="text"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Reminder</FormLabel>
                                <FormControl>
                                  <Input {...field} defaultValue={reminder.text} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <Button type="submit">Update</Button>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                  <Button variant="destructive" size="sm" className="ml-2" onClick={() => handleDeleteReminder(reminder.id)}>Delete</Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>AI Assistant</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{aiResponse}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
          </CardHeader>
          <CardContent>
            <ul>
              {events.map((event) => (
                <li key={event.id} className="mb-2">
                  {event.summary}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="ml-2">Edit</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Event</DialogTitle>
                      </DialogHeader>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit((data) => handleUpdateEvent(event.id, data))}>
                          <FormField
                            control={form.control}
                            name="summary"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Event</FormLabel>
                                <FormControl>
                                  <Input {...field} defaultValue={event.summary} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <Button type="submit">Update</Button>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                  <Button variant="destructive" size="sm" className="ml-2" onClick={() => handleDeleteEvent(event.id)}>Delete</Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}