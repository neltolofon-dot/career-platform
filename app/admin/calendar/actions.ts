'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireAdminApi } from '@/lib/auth/guard'
import { setAppointmentStatus, blockDay } from '@/lib/services/booking'

const statusSchema = z.object({
  id: z.string().cuid(),
  status: z.enum(['CONFIRMED', 'DECLINED', 'CANCELLED', 'COMPLETED']),
})

export async function setStatusAction(formData: FormData) {
  await requireAdminApi()

  // Validation Zod plutôt qu'un cast : une Server Action est un point
  // d'entrée HTTP, son FormData vient du client.
  const parsed = statusSchema.safeParse({
    id: formData.get('id'),
    status: formData.get('status'),
  })
  if (!parsed.success) return

  await setAppointmentStatus(parsed.data.id, parsed.data.status)
  revalidatePath('/admin/calendar')
}

const blockSchema = z.object({ date: z.string().date() })

export async function blockDayAction(formData: FormData) {
  await requireAdminApi()

  const parsed = blockSchema.safeParse({ date: formData.get('date') })
  if (!parsed.success) return

  await blockDay(new Date(parsed.data.date))
  revalidatePath('/admin/calendar')
}
