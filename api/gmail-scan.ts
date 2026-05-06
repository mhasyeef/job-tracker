/* eslint-disable @typescript-eslint/no-require-imports */
const Anthropic = require('@anthropic-ai/sdk')

const GMAIL_QUERY = 'label:Job-Applications newer_than:7d'

type EmailMeta = {
  subject: string
  from: string
  date: string
  snippet: string
}

type ParsedApp = {
  company: string
  role: string
  status: 'applied' | 'in_progress' | 'offer' | 'rejected'
  date: string
  source: string
  notes: string
}

async function fetchEmailMeta(accessToken: string): Promise<EmailMeta[]> {
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?` +
      new URLSearchParams({ q: GMAIL_QUERY, maxResults: '50' }),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!listRes.ok) throw new Error(`Gmail list failed (${listRes.status}): ${await listRes.text()}`)

  const { messages = [] } = (await listRes.json()) as { messages?: { id: string }[] }

  const results: EmailMeta[] = []
  await Promise.all(
    messages.slice(0, 30).map(async ({ id }: { id: string }) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}` +
          `?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!res.ok) return
      const msg = await res.json()
      const headers: { name: string; value: string }[] = msg.payload?.headers ?? []
      const get = (n: string) => headers.find((h: { name: string; value: string }) => h.name === n)?.value ?? ''
      results.push({
        subject: get('Subject'),
        from: get('From'),
        date: get('Date'),
        snippet: msg.snippet ?? '',
      })
    })
  )
  return results
}

const SYSTEM_PROMPT = `You extract job application data from email metadata. Only include emails that clearly represent a job application event.

Status values:
- "applied": application submitted or confirmation received
- "in_progress": interview, phone screen, assessment, or "next steps"
- "offer": job offer or "pleased to offer"
- "rejected": "not moving forward", "other candidates", position filled

If multiple emails cover the same company+role, keep only the highest-status one.`

async function parseWithClaude(emails: EmailMeta[]): Promise<ParsedApp[]> {
  if (emails.length === 0) return []

  const AnthropicClass = Anthropic.default ?? Anthropic
  const client = new AnthropicClass({ apiKey: process.env.ANTHROPIC_API_KEY })

  const content = emails
    .map(
      (e, i) =>
        `--- Email ${i + 1} ---\nSubject: ${e.subject}\nFrom: ${e.from}\nDate: ${e.date}\nSnippet: ${e.snippet}`
    )
    .join('\n\n')

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: `Parse these emails and return a JSON array only — no markdown, no explanation.

Each object must have:
- company: string
- role: string
- status: "applied" | "in_progress" | "offer" | "rejected"
- date: "YYYY-MM-DD" (parsed from the Date header)
- source: string ("LinkedIn", "Indeed", company domain, or "Direct")
- notes: string (max 100 chars, empty string if nothing notable)

${content}`,
      },
    ],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
  try {
    return JSON.parse(text) as ParsedApp[]
  } catch {
    const m = text.match(/\[[\s\S]*\]/)
    return m ? (JSON.parse(m[0]) as ParsedApp[]) : []
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
module.exports = async function handler(req: any, res: any) {
  console.log('ANTHROPIC_API_KEY exists:', !!process.env.ANTHROPIC_API_KEY)
  console.log('KEY value:', process.env.ANTHROPIC_API_KEY?.slice(0, 10))
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { accessToken } = req.body as { accessToken?: string }
  if (!accessToken) return res.status(400).json({ error: 'accessToken required' })

  try {
    const emails = await fetchEmailMeta(accessToken)
    const applications = await parseWithClaude(emails)
    return res.json({ applications })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Scan failed' })
  }
}
