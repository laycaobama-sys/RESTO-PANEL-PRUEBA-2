import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { getCurrentUser } from '@/lib/session'

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de archivo no soportado' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo es demasiado grande (máx 5MB)' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${user.restaurantId}-${Date.now()}.${ext}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadDir, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(uploadDir, fileName), buffer)

    return NextResponse.json({ url: `/uploads/${fileName}` })
  } catch (e) {
    console.error('Upload error', e)
    return NextResponse.json({ error: 'Error al subir el archivo' }, { status: 500 })
  }
}
