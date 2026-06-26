import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { hashPassword, slugify } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const url = new URL(req.url)
    let force = url.searchParams.get('force') === 'true'
    if (!force && req.headers.get('content-type')?.includes('application/json')) {
      try {
        const body = await req.json()
        if (body?.force === true) force = true
      } catch {
        /* not JSON, ignore */
      }
    }

    if (force) {
      // Wipe all tenant data. Order matters for FK constraints.
      const wipe = async (table: string) => {
        const { error } = await supabaseAdmin.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
        if (error) console.log(`skip ${table}:`, error.message)
      }
      await wipe('order_items')
      await wipe('orders')
      await wipe('reservations')
      await wipe('tables')
      await wipe('menu_items')
      await wipe('categories')
      await wipe('organization_settings')
      await wipe('verification_tokens')
      await wipe('users')
      await wipe('organizations')
    }

    // Check if already seeded
    const { data: existing } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', 'la-zamorana')
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ ok: true, message: 'Ya estaba seeded', slug: 'la-zamorana' })
    }

    const passwordHash = await hashPassword('demo1234')

    // ============================================================
    // TENANT 1: La Zamorana
    // ============================================================
    const { data: restaurant } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: 'La Zamorana',
        slug: 'la-zamorana',
        phone: '+34 923 456 789',
        email: 'hola@lazamorana.es',
        address: 'Calle Mayor 24',
        city: 'Salamanca',
        postal_code: '37001',
        country: 'España',
        description: 'Bar de toda la vida. Tapas, raciones y buenos vinos en el corazón de Salamanca.',
        primary_color: '#FF6B35',
        currency: 'EUR',
        opening_hours: 'Lun-Dom: 09:00 - 23:30',
      })
      .select()
      .single()
    if (!restaurant) throw new Error('Failed to create La Zamorana')

    await supabaseAdmin.from('organization_settings').insert({
      organization_id: restaurant.id,
    })

    const { data: user } = await supabaseAdmin
      .from('users')
      .insert({
        name: 'Carmen Zamorano',
        email: 'demo@lazamorana.es',
        password_hash: passwordHash,
        role: 'ADMIN',
        organization_id: restaurant.id,
        phone: '+34 600 123 456',
      })
      .select()
      .single()

    // Categories
    const catNames = [
      { name: 'Hamburguesas', slug: 'hamburguesas', sort_order: 1, icon: '🍔' },
      { name: 'Platos Combinados', slug: 'platos-combinados', sort_order: 2, icon: '🍽️' },
      { name: 'Raciones', slug: 'raciones', sort_order: 3, icon: '🥘' },
      { name: 'Bocadillos', slug: 'bocadillos', sort_order: 4, icon: '🥪' },
      { name: 'Desayunos', slug: 'desayunos', sort_order: 5, icon: '☕' },
      { name: 'Bebidas con alcohol', slug: 'bebidas-con-alcohol', sort_order: 6, icon: '🍺' },
      { name: 'Bebidas sin alcohol', slug: 'bebidas-sin-alcohol', sort_order: 7, icon: '🥤' },
      { name: 'Postres', slug: 'postres', sort_order: 8, icon: '🍰' },
    ]
    const { data: cats } = await supabaseAdmin
      .from('categories')
      .insert(catNames.map((c) => ({ ...c, organization_id: restaurant.id, visible: true })))
      .select()
    const catMap = new Map((cats || []).map((c: any) => [c.name, c]))

    const itemRows: any[] = []
    const add = (cat: string, name: string, description: string, price: number, allergens?: string) => {
      const c = catMap.get(cat)
      if (c) itemRows.push({
        name, description, price, allergens: allergens || null,
        category_id: c.id, organization_id: restaurant.id,
        available: true, visible: true, sort_order: 0,
      })
    }
    add('Hamburguesas', 'Hamburguesa Clásica', 'Carne de ternera 150g, lechuga, tomate, queso y salsa especial', 9.5, 'gluten, lactosa')
    add('Hamburguesas', 'Hamburguesa Zamorana', 'Doble carne, bacon, queso cheddar, cebolla caramelizada', 12.5, 'gluten, lactosa')
    add('Hamburguesas', 'Hamburguesa de Pollo', 'Filete de pollo rebozado, lechuga, tomate, mayonesa', 9.0, 'gluten, lactosa')
    add('Hamburguesas', 'Hamburguesa Vegana', 'Hamburguesa de garbanzos, rúcula, tomate, aguacate', 10.5, 'gluten')
    add('Hamburguesas', 'Hamburguesa Bacon Cheese', 'Carne, bacon crujiente, doble queso, salsa bbq', 11.5, 'gluten, lactosa')
    add('Platos Combinados', 'Filete con patatas', 'Filete de ternera a la plancha con patatas fritas caseras', 13.5, 'gluten')
    add('Platos Combinados', 'Pollo asado con guarnición', 'Cuarto de pollo al horno con patatas y ensalada', 11.0)
    add('Platos Combinados', 'Merluza a la romana', 'Merluza rebozada con limón y patatas', 14.5, 'gluten, pescado')
    add('Platos Combinados', 'Huevos rotos con jamón', 'Huevos fritos, patatas y jamón ibérico', 10.5, 'huevo')
    add('Platos Combinados', 'Entrecote a la parrilla', 'Entrecote de ternera con guarnición y salsa', 16.5)
    add('Raciones', 'Patatas bravas', 'Patatas fritas con salsa brava casera', 6.5)
    add('Raciones', 'Calamares a la andaluza', 'Calamares rebozados fritos con limón', 9.5, 'gluten, pescado, moluscos')
    add('Raciones', 'Croquetas caseras (8 uds)', 'Croquetas de jamón ibérico', 8.5, 'gluten, lactosa, huevo')
    add('Raciones', 'Tortilla de patatas', 'Ración de tortilla española (4-6 personas)', 7.5, 'huevo, lactosa')
    add('Raciones', 'Jamón ibérico', 'Tabla de jamón ibérico de bellota', 14.0)
    add('Raciones', 'Queso manchego', 'Tabla de queso curado con membrillo', 8.5, 'lactosa')
    add('Raciones', 'Pimientos de Padrón', 'Pimientos fritos con sal gruesa', 6.5)
    add('Bocadillos', 'Bocadillo de calamares', 'Bocadillo con calamares rebozados y mayonesa', 6.5, 'gluten, huevo, moluscos')
    add('Bocadillos', 'Bocadillo de jamón', 'Pan con jamón serrano y tomate', 5.5, 'gluten')
    add('Bocadillos', 'Bocadillo de tortilla', 'Tortilla de patatas en pan', 5.0, 'gluten, huevo, lactosa')
    add('Bocadillos', 'Bocadillo de lomo', 'Lomo adobado con pimientos', 6.0, 'gluten')
    add('Desayunos', 'Café con leche + tostada', 'Tostada con tomate y aceite, café con leche', 3.5, 'gluten, lactosa')
    add('Desayunos', 'Desayuno completo', 'Zumo, tostada, café y repostería', 6.0, 'gluten, lactosa, huevo')
    add('Desayunos', 'Tostada de jamón', 'Pan tostado con jamón y aceite', 4.5, 'gluten')
    add('Desayunos', 'Chocolate con churros', 'Chocolate caliente y ración de churros (6 uds)', 4.0, 'gluten, lactosa, huevo')
    add('Bebidas con alcohol', 'Caña de cerveza', 'Cerveza de barril 200ml', 1.5)
    add('Bebidas con alcohol', 'Doble de cerveza', 'Cerveza de barril 400ml', 2.5)
    add('Bebidas con alcohol', 'Vino tinto (copa)', 'Vino de la casa (Rioja)', 2.5, 'sulfitos')
    add('Bebidas con alcohol', 'Vino blanco (copa)', 'Vino de la casa (Rueda)', 2.5, 'sulfitos')
    add('Bebidas con alcohol', 'Tinto de verano', 'Vino tinto con refresco de limón', 3.0, 'sulfitos')
    add('Bebidas con alcohol', 'Sangría (vaso)', 'Sangría casera de la casa', 3.5, 'sulfitos')
    add('Bebidas sin alcohol', 'Agua mineral', 'Botella 500ml', 1.5)
    add('Bebidas sin alcohol', 'Refresco', 'Coca-Cola, Fanta, Sprite', 2.0)
    add('Bebidas sin alcohol', 'Zumo natural', 'Naranja natural recién exprimida', 3.0)
    add('Bebidas sin alcohol', 'Café americano', 'Café solo con agua caliente', 1.5)
    add('Bebidas sin alcohol', 'Café con leche', 'Café con leche de vaca o avena', 1.8, 'lactosa')
    add('Postres', 'Tarta de queso', 'Tarta casera con mermelada de frutos rojos', 4.5, 'lactosa, huevo, gluten')
    add('Postres', 'Flan de huevo', 'Flan casero con caramelo', 3.5, 'huevo, lactosa')
    add('Postres', 'Helado artesano', 'Dos bolas a elegir', 3.5, 'lactosa')
    add('Postres', 'Tocino de cielo', 'Postre tradicional de yema de huevo', 3.0, 'huevo, lactosa')
    await supabaseAdmin.from('menu_items').insert(itemRows)

    // Tables
    const tableRows: any[] = [
      { number: '1', capacity: 2, zone: 'INTERIOR', name: 'Mesa 1', status: 'AVAILABLE', shape: 'SQUARE', pos_x: 60, pos_y: 80 },
      { number: '2', capacity: 4, zone: 'INTERIOR', name: 'Mesa 2', status: 'OCCUPIED', shape: 'ROUND', pos_x: 200, pos_y: 80 },
      { number: '3', capacity: 4, zone: 'INTERIOR', name: 'Mesa 3', status: 'AVAILABLE', shape: 'ROUND', pos_x: 340, pos_y: 80 },
      { number: '4', capacity: 6, zone: 'INTERIOR', name: 'Mesa 4', status: 'RESERVED', shape: 'RECTANGLE', pos_x: 60, pos_y: 200 },
      { number: '5', capacity: 2, zone: 'INTERIOR', name: 'Mesa 5', status: 'PREPARING', shape: 'SQUARE', pos_x: 200, pos_y: 220 },
      { number: 'V1', capacity: 8, zone: 'VIP', name: 'Sala Privada', status: 'AVAILABLE', shape: 'RECTANGLE', pos_x: 460, pos_y: 200 },
      { number: '6', capacity: 4, zone: 'TERRACE', name: 'Terraza 1', status: 'OCCUPIED', shape: 'ROUND', pos_x: 560, pos_y: 80 },
      { number: '7', capacity: 4, zone: 'TERRACE', name: 'Terraza 2', status: 'AVAILABLE', shape: 'ROUND', pos_x: 700, pos_y: 80 },
      { number: '8', capacity: 6, zone: 'TERRACE', name: 'Terraza 3', status: 'AVAILABLE', shape: 'RECTANGLE', pos_x: 560, pos_y: 220 },
      { number: '9', capacity: 2, zone: 'BAR', name: 'Barra 1', status: 'AVAILABLE', shape: 'RECTANGLE', pos_x: 60, pos_y: 360 },
      { number: '10', capacity: 2, zone: 'BAR', name: 'Barra 2', status: 'OCCUPIED', shape: 'RECTANGLE', pos_x: 200, pos_y: 360 },
    ].map((t) => ({ ...t, organization_id: restaurant.id }))
    const { data: tables } = await supabaseAdmin.from('tables').insert(tableRows).select()
    const tableIdByNumber = new Map((tables || []).map((t: any) => [t.number, t.id]))

    // Orders (using deterministic timestamps so the dashboard always shows recent activity)
    const { data: menuItemsList } = await supabaseAdmin
      .from('menu_items')
      .select('id, name, price')
      .eq('organization_id', restaurant.id)
    const randomItem = () => menuItemsList![Math.floor(Math.random() * (menuItemsList?.length || 1))]

    const now = new Date()
    const orderSpecs: Array<{ tableNumber: string | null; status: string; minutesAgo: number; itemCount: number }> = [
      { tableNumber: '2', status: 'PREPARING', minutesAgo: 12, itemCount: 3 },
      { tableNumber: '5', status: 'PENDING', minutesAgo: 4, itemCount: 2 },
      { tableNumber: '10', status: 'PENDING', minutesAgo: 2, itemCount: 1 },
      { tableNumber: '5', status: 'SERVED', minutesAgo: 35, itemCount: 4 },
      { tableNumber: '2', status: 'COMPLETED', minutesAgo: 95, itemCount: 2 },
      { tableNumber: '3', status: 'COMPLETED', minutesAgo: 180, itemCount: 5 },
      { tableNumber: 'V1', status: 'COMPLETED', minutesAgo: 145, itemCount: 3 },
      { tableNumber: '10', status: 'COMPLETED', minutesAgo: 220, itemCount: 2 },
      { tableNumber: '6', status: 'PREPARING', minutesAgo: 8, itemCount: 4 },
      { tableNumber: '5', status: 'COMPLETED', minutesAgo: 70, itemCount: 2 },
      { tableNumber: 'V1', status: 'COMPLETED', minutesAgo: 210, itemCount: 3 },
      { tableNumber: '6', status: 'COMPLETED', minutesAgo: 165, itemCount: 3 },
      { tableNumber: '3', status: 'CANCELLED', minutesAgo: 60, itemCount: 2 },
      { tableNumber: 'V1', status: 'COMPLETED', minutesAgo: 250, itemCount: 4 },
      { tableNumber: '2', status: 'COMPLETED', minutesAgo: 300, itemCount: 3 },
    ]
    let orderNumber = 1000
    for (const spec of orderSpecs) {
      const createdAt = new Date(now.getTime() - spec.minutesAgo * 60000).toISOString()
      const chosenItems = Array.from({ length: spec.itemCount }, () => {
        const it = randomItem()
        return { menuItemId: it.id, quantity: 1 + Math.floor(Math.random() * 2), unitPrice: Number(it.price) }
      })
      const total = chosenItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
      const tableId = spec.tableNumber ? tableIdByNumber.get(spec.tableNumber) : null
      const { data: order } = await supabaseAdmin
        .from('orders')
        .insert({
          number: ++orderNumber,
          status: spec.status,
          order_type: 'DINE_IN',
          total,
          created_at: createdAt,
          updated_at: createdAt,
          table_id: tableId || null,
          organization_id: restaurant.id,
        })
        .select()
        .single()
      if (order) {
        await supabaseAdmin.from('order_items').insert(
          chosenItems.map((i) => ({
            order_id: order.id,
            menu_item_id: i.menuItemId,
            quantity: i.quantity,
            unit_price: i.unitPrice,
            organization_id: restaurant.id,
            created_at: createdAt,
          }))
        )
      }
    }

    // Reservations
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const resSpecs: any[] = [
      { name: 'María García', phone: '+34 611 222 333', size: 4, hourOffset: 14, status: 'CONFIRMED', tableNumber: '4', zone: 'INTERIOR', shift: 'LUNCH' },
      { name: 'Pedro López', phone: '+34 622 333 444', size: 2, hourOffset: 13.5, status: 'CONFIRMED', tableNumber: '6', zone: 'TERRACE', shift: 'LUNCH' },
      { name: 'Ana Martín', phone: '+34 633 444 555', size: 6, hourOffset: 21, status: 'PENDING', tableNumber: 'V1', zone: 'VIP', shift: 'DINNER' },
      { name: 'Javier Ruiz', phone: '+34 644 555 666', size: 3, hourOffset: 20, status: 'CONFIRMED', tableNumber: '7', zone: 'TERRACE', shift: 'DINNER' },
      { name: 'Lucía Sánchez', phone: '+34 655 666 777', size: 2, hourOffset: 15, status: 'CANCELLED', tableNumber: null, zone: 'INTERIOR', shift: 'LUNCH' },
      { name: 'Miguel Torres', phone: '+34 666 777 888', size: 4, hourOffset: 14, status: 'CONFIRMED', tableNumber: '3', zone: 'INTERIOR', shift: 'LUNCH' },
      { name: 'Sofía Díaz', phone: '+34 677 888 999', size: 8, hourOffset: 21.5, status: 'CONFIRMED', tableNumber: 'V1', zone: 'VIP', shift: 'DINNER' },
      { name: 'Carlos Romero', phone: '+34 688 999 000', size: 2, hourOffset: 22, status: 'PENDING', tableNumber: '10', zone: 'BAR', shift: 'DINNER' },
    ]
    const resRows = resSpecs.map((r) => {
      const date = new Date(today)
      date.setHours(Math.floor(r.hourOffset), r.hourOffset % 1 ? 30 : 0, 0, 0)
      return {
        customer_name: r.name,
        phone: r.phone,
        party_size: r.size,
        date: date.toISOString(),
        status: r.status,
        shift: r.shift,
        zone: r.zone,
        source: 'PHONE',
        table_id: r.tableNumber ? tableIdByNumber.get(r.tableNumber) : null,
        organization_id: restaurant.id,
      }
    })
    await supabaseAdmin.from('reservations').insert(resRows)

    // ============================================================
    // TENANT 2: Bistró del Puerto (to prove isolation)
    // ============================================================
    const { data: existing2 } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', 'bistro-del-puerto')
      .maybeSingle()
    if (!existing2) {
      const { data: restaurant2 } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: 'Bistró del Puerto',
          slug: 'bistro-del-puerto',
          phone: '+34 956 111 222',
          email: 'hola@bistrodelpuerto.es',
          address: 'Paseo Marítimo 5',
          city: 'Cádiz',
          postal_code: '11001',
          country: 'España',
          description: 'Cocina marinera y arroces frente al mar.',
          primary_color: '#0EA5E9',
          currency: 'EUR',
        })
        .select()
        .single()
      if (restaurant2) {
        await supabaseAdmin.from('organization_settings').insert({ organization_id: restaurant2.id })
        await supabaseAdmin.from('users').insert({
          name: 'Laura Marín',
          email: 'demo@bistrodelpuerto.es',
          password_hash: passwordHash,
          role: 'ADMIN',
          organization_id: restaurant2.id,
          phone: '+34 600 999 888',
        })
        const { data: cat2 } = await supabaseAdmin
          .from('categories')
          .insert({ name: 'Arroces', slug: 'arroces', sort_order: 1, icon: '🍚', visible: true, organization_id: restaurant2.id })
          .select()
          .single()
        if (cat2) {
          await supabaseAdmin.from('menu_items').insert({
            name: 'Arroz con marisco',
            description: 'Arroz meloso con marisco fresco del día',
            price: 16.5,
            allergens: 'pescado, moluscos',
            category_id: cat2.id,
            organization_id: restaurant2.id,
            available: true,
            visible: true,
            sort_order: 0,
          })
        }
        await supabaseAdmin.from('tables').insert({
          number: '1', capacity: 4, zone: 'TERRACE', shape: 'ROUND',
          pos_x: 50, pos_y: 50, status: 'AVAILABLE',
          organization_id: restaurant2.id,
        })
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'La Zamorana y Bistró del Puerto seeded correctamente (Supabase)',
      slug: 'la-zamorana',
      credentials: [
        { restaurant: 'La Zamorana', email: 'demo@lazamorana.es', password: 'demo1234' },
        { restaurant: 'Bistró del Puerto', email: 'demo@bistrodelpuerto.es', password: 'demo1234' },
      ],
    })
  } catch (e) {
    console.error('Seed error', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
