import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, slugify } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    // Allow forcing a fresh seed via ?force=true or { force: true }
    const url = new URL(req.url)
    const force =
      url.searchParams.get('force') === 'true' ||
      (req.method === 'POST' && (await req.json().catch(() => ({}))).force === true)

    if (force) {
      // Wipe all tenant data. Order matters for FK constraints.
      await db.$transaction([
        db.verificationToken.deleteMany(),
        db.orderItem.deleteMany(),
        db.order.deleteMany(),
        db.reservation.deleteMany(),
        db.table.deleteMany(),
        db.menuItem.deleteMany(),
        db.category.deleteMany(),
        db.restaurantSetting.deleteMany(),
        db.user.deleteMany(),
        db.restaurant.deleteMany(),
      ])
    }

    // Check if already seeded
    const existing = await db.restaurant.findUnique({ where: { slug: 'la-zamorana' } })
    if (existing) {
      return NextResponse.json({ ok: true, message: 'Ya estaba seeded', slug: 'la-zamorana' })
    }

    const passwordHash = await hashPassword('demo1234')

    const restaurant = await db.restaurant.create({
      data: {
        name: 'La Zamorana',
        slug: 'la-zamorana',
        phone: '+34 923 456 789',
        email: 'hola@lazamorana.es',
        address: 'Calle Mayor 24',
        city: 'Salamanca',
        postalCode: '37001',
        description: 'Bar de toda la vida. Tapas, raciones y buenos vinos en el corazón de Salamanca.',
        primaryColor: '#FF6B35',
        currency: 'EUR',
        openingHours: 'Lun-Dom: 09:00 - 23:30',
        websiteUrl: '',
        publicEnabled: true,
        posEnabled: true,
        reservationsEnabled: true,
        settings: { create: {} },
      },
    })

    await db.user.create({
      data: {
        name: 'Carmen Zamorano',
        email: 'demo@lazamorana.es',
        passwordHash,
        role: 'ADMIN',
        restaurantId: restaurant.id,
        phone: '+34 600 123 456',
      },
    })

    // Categories
    const cats = await Promise.all([
      db.category.create({ data: { name: 'Hamburguesas', slug: 'hamburguesas', sortOrder: 1, restaurantId: restaurant.id, icon: '🍔' } }),
      db.category.create({ data: { name: 'Platos Combinados', slug: 'platos-combinados', sortOrder: 2, restaurantId: restaurant.id, icon: '🍽️' } }),
      db.category.create({ data: { name: 'Raciones', slug: 'raciones', sortOrder: 3, restaurantId: restaurant.id, icon: '🥘' } }),
      db.category.create({ data: { name: 'Bocadillos', slug: 'bocadillos', sortOrder: 4, restaurantId: restaurant.id, icon: '🥪' } }),
      db.category.create({ data: { name: 'Desayunos', slug: 'desayunos', sortOrder: 5, restaurantId: restaurant.id, icon: '☕' } }),
      db.category.create({ data: { name: 'Bebidas con alcohol', slug: 'bebidas-con-alcohol', sortOrder: 6, restaurantId: restaurant.id, icon: '🍺' } }),
      db.category.create({ data: { name: 'Bebidas sin alcohol', slug: 'bebidas-sin-alcohol', sortOrder: 7, restaurantId: restaurant.id, icon: '🥤' } }),
      db.category.create({ data: { name: 'Postres', slug: 'postres', sortOrder: 8, restaurantId: restaurant.id, icon: '🍰' } }),
    ])

    const [hamburguesas, platos, raciones, bocadillos, desayunos, conAlcohol, sinAlcohol, postres] = cats

    // Helper to create menu item
    const item = (name: string, description: string, price: number, categoryId: string, image?: string, allergens?: string) =>
      db.menuItem.create({
        data: { name, description, price, categoryId, restaurantId: restaurant.id, image, allergens },
      })

    // Hamburguesas
    await Promise.all([
      item('Hamburguesa Clásica', 'Carne de ternera 150g, lechuga, tomate, queso y salsa especial', 9.5, hamburguesas.id, '', 'gluten, lactosa'),
      item('Hamburguesa Zamorana', 'Doble carne, bacon, queso cheddar, cebolla caramelizada', 12.5, hamburguesas.id, '', 'gluten, lactosa'),
      item('Hamburguesa de Pollo', 'Filete de pollo rebozado, lechuga, tomate, mayonesa', 9.0, hamburguesas.id, '', 'gluten, lactosa'),
      item('Hamburguesa Vegana', 'Hamburguesa de garbanzos, rúcula, tomate, aguacate', 10.5, hamburguesas.id, '', 'gluten'),
      item('Hamburguesa Bacon Cheese', 'Carne, bacon crujiente, doble queso, salsa bbq', 11.5, hamburguesas.id, '', 'gluten, lactosa'),
    ])

    // Platos combinados
    await Promise.all([
      item('Filete con patatas', 'Filete de ternera a la plancha con patatas fritas caseras', 13.5, platos.id, '', 'gluten'),
      item('Pollo asado con guarnición', 'Cuarto de pollo al horno con patatas y ensalada', 11.0, platos.id, '', ''),
      item('Merluza a la romana', 'Merluza rebozada con limón y patatas', 14.5, platos.id, '', 'gluten, pescado'),
      item('Huevos rotos con jamón', 'Huevos fritos, patatas y jamón ibérico', 10.5, platos.id, '', 'huevo'),
      item('Entrecote a la parrilla', 'Entrecote de ternera con guarnición y salsa', 16.5, platos.id, '', ''),
    ])

    // Raciones
    await Promise.all([
      item('Patatas bravas', 'Patatas fritas con salsa brava casera', 6.5, raciones.id, '', ''),
      item('Calamares a la andaluza', 'Calamares rebozados fritos con limón', 9.5, raciones.id, '', 'gluten, pescado, moluscos'),
      item('Croquetas caseras (8 uds)', 'Croquetas de jamón ibérico', 8.5, raciones.id, '', 'gluten, lactosa, huevo'),
      item('Tortilla de patatas', 'Ración de tortilla española (4-6 personas)', 7.5, raciones.id, '', 'huevo, lactosa'),
      item('Jamón ibérico', 'Tabla de jamón ibérico de bellota', 14.0, raciones.id, '', ''),
      item('Queso manchego', 'Tabla de queso curado con membrillo', 8.5, raciones.id, '', 'lactosa'),
      item('Pimientos de Padrón', 'Pimientos fritos con sal gruesa', 6.5, raciones.id, '', ''),
    ])

    // Bocadillos
    await Promise.all([
      item('Bocadillo de calamares', 'Bocadillo con calamares rebozados y mayonesa', 6.5, bocadillos.id, '', 'gluten, huevo, moluscos'),
      item('Bocadillo de jamón', 'Pan con jamón serrano y tomate', 5.5, bocadillos.id, '', 'gluten'),
      item('Bocadillo de tortilla', 'Tortilla de patatas en pan', 5.0, bocadillos.id, '', 'gluten, huevo, lactosa'),
      item('Bocadillo de lomo', 'Lomo adobado con pimientos', 6.0, bocadillos.id, '', 'gluten'),
    ])

    // Desayunos
    await Promise.all([
      item('Café con leche + tostada', 'Tostada con tomate y aceite, café con leche', 3.5, desayunos.id, '', 'gluten, lactosa'),
      item('Desayuno completo', 'Zumo, tostada, café y repostería', 6.0, desayunos.id, '', 'gluten, lactosa, huevo'),
      item('Tostada de jamón', 'Pan tostado con jamón y aceite', 4.5, desayunos.id, '', 'gluten'),
      item('Chocolate con churros', 'Chocolate caliente y ración de churros (6 uds)', 4.0, desayunos.id, '', 'gluten, lactosa, huevo'),
    ])

    // Bebidas con alcohol
    await Promise.all([
      item('Caña de cerveza', 'Cerveza de barril 200ml', 1.5, conAlcohol.id, '', ''),
      item('Doble de cerveza', 'Cerveza de barril 400ml', 2.5, conAlcohol.id, '', ''),
      item('Vino tinto (copa)', 'Vino de la casa (Rioja)', 2.5, conAlcohol.id, '', 'sulfitos'),
      item('Vino blanco (copa)', 'Vino de la casa (Rueda)', 2.5, conAlcohol.id, '', 'sulfitos'),
      item('Tinto de verano', 'Vino tinto con refresco de limón', 3.0, conAlcohol.id, '', 'sulfitos'),
      item('Sangría (vaso)', 'Sangría casera de la casa', 3.5, conAlcohol.id, '', 'sulfitos'),
    ])

    // Bebidas sin alcohol
    await Promise.all([
      item('Agua mineral', 'Botella 500ml', 1.5, sinAlcohol.id, '', ''),
      item('Refresco', 'Coca-Cola, Fanta, Sprite', 2.0, sinAlcohol.id, '', ''),
      item('Zumo natural', 'Naranja natural recién exprimida', 3.0, sinAlcohol.id, '', ''),
      item('Café americano', 'Café solo con agua caliente', 1.5, sinAlcohol.id, '', ''),
      item('Café con leche', 'Café con leche de vaca o avena', 1.8, sinAlcohol.id, '', 'lactosa'),
    ])

    // Postres
    await Promise.all([
      item('Tarta de queso', 'Tarta casera con mermelada de frutos rojos', 4.5, postres.id, '', 'lactosa, huevo, gluten'),
      item('Flan de huevo', 'Flan casero con caramelo', 3.5, postres.id, '', 'huevo, lactosa'),
      item('Helado artesano', 'Dos bolas a elegir', 3.5, postres.id, '', 'lactosa'),
      item('Tocino de cielo', 'Postre tradicional de yema de huevo', 3.0, postres.id, '', 'huevo, lactosa'),
    ])

    // Tables - with floor-plan positions (posX, posY) and shape for the
    // visual table map. The grid is roughly 800x500 per zone.
    const tablesData: Array<{
      number: string; capacity: number; zone: string; name?: string;
      status: string; shape: string; posX: number; posY: number;
    }> = [
      // Interior (left half of the floor)
      { number: '1', capacity: 2, zone: 'INTERIOR', name: 'Mesa 1',  status: 'AVAILABLE', shape: 'SQUARE',    posX: 60,  posY: 80 },
      { number: '2', capacity: 4, zone: 'INTERIOR', name: 'Mesa 2',  status: 'OCCUPIED', shape: 'ROUND',     posX: 200, posY: 80 },
      { number: '3', capacity: 4, zone: 'INTERIOR', name: 'Mesa 3',  status: 'AVAILABLE', shape: 'ROUND',     posX: 340, posY: 80 },
      { number: '4', capacity: 6, zone: 'INTERIOR', name: 'Mesa 4',  status: 'RESERVED', shape: 'RECTANGLE', posX: 60,  posY: 200 },
      { number: '5', capacity: 2, zone: 'INTERIOR', name: 'Mesa 5',  status: 'PREPARING', shape: 'SQUARE',   posX: 200, posY: 220 },
      // VIP (small private area)
      { number: 'V1', capacity: 8, zone: 'VIP', name: 'Sala Privada', status: 'AVAILABLE', shape: 'RECTANGLE', posX: 460, posY: 200 },
      // Terrace (right half)
      { number: '6', capacity: 4, zone: 'TERRACE', name: 'Terraza 1', status: 'OCCUPIED',  shape: 'ROUND', posX: 560, posY: 80 },
      { number: '7', capacity: 4, zone: 'TERRACE', name: 'Terraza 2', status: 'AVAILABLE', shape: 'ROUND', posX: 700, posY: 80 },
      { number: '8', capacity: 6, zone: 'TERRACE', name: 'Terraza 3', status: 'AVAILABLE', shape: 'RECTANGLE', posX: 560, posY: 220 },
      // Bar
      { number: '9',  capacity: 2, zone: 'BAR', name: 'Barra 1', status: 'AVAILABLE', shape: 'RECTANGLE', posX: 60,  posY: 360 },
      { number: '10', capacity: 2, zone: 'BAR', name: 'Barra 2', status: 'OCCUPIED',  shape: 'RECTANGLE', posX: 200, posY: 360 },
    ]
    const tables = await Promise.all(
      tablesData.map((t) =>
        db.table.create({
          data: {
            number: t.number,
            name: t.name,
            capacity: t.capacity,
            zone: t.zone,
            status: t.status as any,
            shape: t.shape,
            posX: t.posX,
            posY: t.posY,
            restaurantId: restaurant.id,
          },
        })
      )
    )

    // Orders (mix of today's and recent)
    const now = new Date()
    const itemsList = await db.menuItem.findMany({ where: { restaurantId: restaurant.id } })
    const randomItem = () => itemsList[Math.floor(Math.random() * itemsList.length)]

    const orderSpecs: Array<{ tableIdx: number; status: string; minutesAgo: number; itemCount: number; type?: string }> = [
      { tableIdx: 1, status: 'PREPARING', minutesAgo: 12, itemCount: 3 },  // Mesa 2
      { tableIdx: 4, status: 'PENDING', minutesAgo: 4, itemCount: 2 },     // Mesa 5
      { tableIdx: 9, status: 'PENDING', minutesAgo: 2, itemCount: 1 },     // Barra 2
      { tableIdx: 4, status: 'SERVED', minutesAgo: 35, itemCount: 4 },     // Mesa 5
      { tableIdx: 1, status: 'COMPLETED', minutesAgo: 95, itemCount: 2 },  // Mesa 2
      { tableIdx: 2, status: 'COMPLETED', minutesAgo: 180, itemCount: 5 }, // Mesa 3
      { tableIdx: 5, status: 'COMPLETED', minutesAgo: 145, itemCount: 3 }, // Sala VIP
      { tableIdx: 9, status: 'COMPLETED', minutesAgo: 220, itemCount: 2 }, // Barra 2
      { tableIdx: 6, status: 'PREPARING', minutesAgo: 8, itemCount: 4 },   // Terraza 1
      { tableIdx: 4, status: 'COMPLETED', minutesAgo: 70, itemCount: 2 },  // Mesa 5
      { tableIdx: 5, status: 'COMPLETED', minutesAgo: 210, itemCount: 3 }, // Sala VIP
      { tableIdx: 6, status: 'COMPLETED', minutesAgo: 165, itemCount: 3 }, // Terraza 1
      { tableIdx: 2, status: 'CANCELLED', minutesAgo: 60, itemCount: 2 },  // Mesa 3
      { tableIdx: 5, status: 'COMPLETED', minutesAgo: 250, itemCount: 4 }, // Sala VIP
      { tableIdx: 1, status: 'COMPLETED', minutesAgo: 300, itemCount: 3 }, // Mesa 2
    ]

    let orderNumber = 1000
    for (const spec of orderSpecs) {
      const createdAt = new Date(now.getTime() - spec.minutesAgo * 60000)
      const chosenItems = Array.from({ length: spec.itemCount }, () => {
        const it = randomItem()
        return { menuItemId: it.id, quantity: 1 + Math.floor(Math.random() * 2), unitPrice: it.price }
      })
      const total = chosenItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
      const tableId = tables[spec.tableIdx]?.id
      await db.order.create({
        data: {
          number: ++orderNumber,
          status: spec.status as any,
          orderType: spec.type || 'DINE_IN',
          total,
          createdAt,
          tableId: tableId || null,
          restaurantId: restaurant.id,
          orderItems: { create: chosenItems },
        },
      })
    }

    // Reservations
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const resSpecs = [
      { name: 'María García', phone: '+34 611 222 333', size: 4, hourOffset: 14, status: 'CONFIRMED', tableIdx: 3, zone: 'INTERIOR', shift: 'LUNCH' },  // Mesa 4
      { name: 'Pedro López', phone: '+34 622 333 444', size: 2, hourOffset: 13.5, status: 'CONFIRMED', tableIdx: 6, zone: 'TERRACE', shift: 'LUNCH' },  // Terraza 1
      { name: 'Ana Martín', phone: '+34 633 444 555', size: 6, hourOffset: 21, status: 'PENDING', tableIdx: 5, zone: 'VIP', shift: 'DINNER' },           // Sala VIP
      { name: 'Javier Ruiz', phone: '+34 644 555 666', size: 3, hourOffset: 20, status: 'CONFIRMED', tableIdx: 7, zone: 'TERRACE', shift: 'DINNER' },  // Terraza 2
      { name: 'Lucía Sánchez', phone: '+34 655 666 777', size: 2, hourOffset: 15, status: 'CANCELLED', tableIdx: null, zone: 'INTERIOR', shift: 'LUNCH' },
      { name: 'Miguel Torres', phone: '+34 666 777 888', size: 4, hourOffset: 14, status: 'CONFIRMED', tableIdx: 2, zone: 'INTERIOR', shift: 'LUNCH' },  // Mesa 3
      { name: 'Sofía Díaz', phone: '+34 677 888 999', size: 8, hourOffset: 21.5, status: 'CONFIRMED', tableIdx: 5, zone: 'VIP', shift: 'DINNER' },       // Sala VIP
      { name: 'Carlos Romero', phone: '+34 688 999 000', size: 2, hourOffset: 22, status: 'PENDING', tableIdx: 9, zone: 'BAR', shift: 'DINNER' },       // Barra 2
    ]
    for (const r of resSpecs) {
      const date = new Date(today)
      date.setHours(Math.floor(r.hourOffset), r.hourOffset % 1 ? 30 : 0, 0, 0)
      await db.reservation.create({
        data: {
          customerName: r.name,
          phone: r.phone,
          partySize: r.size,
          date,
          status: r.status as any,
          shift: r.shift as any,
          zone: r.zone,
          source: 'PHONE',
          tableId: r.tableIdx !== null ? tables[r.tableIdx]?.id : null,
          restaurantId: restaurant.id,
        },
      })
    }

    // ====================================================================
    // SECOND TENANT: "Bistró del Puerto" - to prove data isolation.
    // A demo user can log in as this restaurant and will see NONE of the
    // data from La Zamorana.
    // ====================================================================
    const existing2 = await db.restaurant.findUnique({ where: { slug: 'bistro-del-puerto' } })
    if (!existing2) {
      const restaurant2 = await db.restaurant.create({
        data: {
          name: 'Bistró del Puerto',
          slug: 'bistro-del-puerto',
          phone: '+34 956 111 222',
          email: 'hola@bistrodelpuerto.es',
          address: 'Paseo Marítimo 5',
          city: 'Cádiz',
          country: 'España',
          description: 'Cocina marinera y arroces frente al mar.',
          primaryColor: '#0EA5E9',
          currency: 'EUR',
          settings: { create: {} },
        },
      })
      await db.user.create({
        data: {
          name: 'Laura Marín',
          email: 'demo@bistrodelpuerto.es',
          passwordHash,
          role: 'ADMIN',
          restaurantId: restaurant2.id,
          phone: '+34 600 999 888',
        },
      })
      const cat = await db.category.create({
        data: { name: 'Arroces', slug: 'arroces', sortOrder: 1, restaurantId: restaurant2.id, icon: '🍚' },
      })
      await db.menuItem.create({
        data: {
          name: 'Arroz con marisco',
          description: 'Arroz meloso con marisco fresco del día',
          price: 16.5,
          categoryId: cat.id,
          restaurantId: restaurant2.id,
          allergens: 'pescado, moluscos',
        },
      })
      await db.table.create({
        data: {
          number: '1',
          capacity: 4,
          zone: 'TERRACE',
          shape: 'ROUND',
          posX: 50,
          posY: 50,
          restaurantId: restaurant2.id,
        },
      })
    }

    return NextResponse.json({
      ok: true,
      message: 'La Zamorana y Bistró del Puerto seeded correctamente',
      slug: restaurant.slug,
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
