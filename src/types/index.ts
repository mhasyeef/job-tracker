export type Status = 'applied' | 'in_progress' | 'offer' | 'rejected'

export interface Application {
  id: string
  user_id: string
  company: string
  role: string
  status: Status
  date: string
  source: string
  notes: string
  created_at: string
  updated_at: string
}

export type ApplicationInput = Omit<Application, 'id' | 'user_id' | 'created_at' | 'updated_at'>
