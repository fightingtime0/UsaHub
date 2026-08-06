import { PrismaClient, UnitType, Role, RoomStatus, PricingDayType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ============================================================
  // TENANT
  // ============================================================
  const tenant = await prisma.tenant.upsert({
    where: { id: 'tenant-demo' },
    update: {},
    create: {
      id: 'tenant-demo',
      name: 'Bisnis Terpadu Demo',
      slug: 'demo',
    },
  })

  console.log('✅ Tenant created')

  // ============================================================
  // BUSINESS UNITS
  // ============================================================
  const toko = await prisma.businessUnit.upsert({
    where: { id: 'unit-toko' },
    update: {},
    create: {
      id: 'unit-toko',
      name: 'Toko Sejahtera',
      type: UnitType.RETAIL,
      location: 'Jl. Pasar Baru No. 12, Kota',
      phone: '0812-0001-0001',
      taxRate: 0,
      tenantId: tenant.id,
    },
  })

  const homestay = await prisma.businessUnit.upsert({
    where: { id: 'unit-homestay' },
    update: {},
    create: {
      id: 'unit-homestay',
      name: 'Homestay Nyaman',
      type: UnitType.HOMESTAY,
      location: 'Jl. Bukit Indah No. 5, Pinggiran Kota',
      phone: '0812-0002-0002',
      taxRate: 0,
      tenantId: tenant.id,
    },
  })

  const restoran = await prisma.businessUnit.upsert({
    where: { id: 'unit-restoran' },
    update: {},
    create: {
      id: 'unit-restoran',
      name: 'Restoran Rasa Nusantara',
      type: UnitType.RESTAURANT,
      location: 'Jl. Merdeka No. 88, Kota',
      phone: '0812-0003-0003',
      taxRate: 11,
      tenantId: tenant.id,
    },
  })

  const penginapan = await prisma.businessUnit.upsert({
    where: { id: 'unit-penginapan' },
    update: {},
    create: {
      id: 'unit-penginapan',
      name: 'Penginapan Merdeka',
      type: UnitType.LODGING,
      location: 'Jl. Merdeka No. 88, Kota', // satu lokasi dengan restoran
      phone: '0812-0004-0004',
      taxRate: 0,
      tenantId: tenant.id,
    },
  })

  const pertashop = await prisma.businessUnit.upsert({
    where: { id: 'unit-pertashop' },
    update: {},
    create: {
      id: 'unit-pertashop',
      name: 'Pertashop Jetis',
      type: UnitType.PERTASHOP,
      location: 'Jl. Raya Jetis KM 3',
      phone: '0812-0005-0005',
      taxRate: 0,
      tenantId: tenant.id,
    },
  })

  console.log('✅ Business units created')

  // ============================================================
  // USERS
  // ============================================================
  const hashedPassword = await bcrypt.hash('password123', 10)

  const owner = await prisma.user.upsert({
    where: { email: 'owner@bisnis.com' },
    update: {},
    create: {
      email: 'owner@bisnis.com',
      name: 'Budi Santoso',
      password: hashedPassword,
      role: Role.OWNER,
      primaryUnitId: null,
      tenantId: tenant.id,
    },
  })

  const managerToko = await prisma.user.upsert({
    where: { email: 'manager.toko@bisnis.com' },
    update: {},
    create: {
      email: 'manager.toko@bisnis.com',
      name: 'Sari Dewi',
      password: hashedPassword,
      role: Role.MANAGER,
      primaryUnitId: toko.id,
      tenantId: tenant.id,
    },
  })

  const kasirRestoran = await prisma.user.upsert({
    where: { email: 'kasir.resto@bisnis.com' },
    update: {},
    create: {
      email: 'kasir.resto@bisnis.com',
      name: 'Andi Pratama',
      password: hashedPassword,
      role: Role.CASHIER,
      primaryUnitId: restoran.id,
      tenantId: tenant.id,
    },
  })

  const staffHomestay = await prisma.user.upsert({
    where: { email: 'staff.homestay@bisnis.com' },
    update: {},
    create: {
      email: 'staff.homestay@bisnis.com',
      name: 'Rina Wati',
      password: hashedPassword,
      role: Role.STAFF,
      primaryUnitId: homestay.id,
      tenantId: tenant.id,
    },
  })

  const staffPertashop = await prisma.user.upsert({
    where: { email: 'staff.pertashop@bisnis.com' },
    update: {},
    create: {
      email: 'staff.pertashop@bisnis.com',
      name: 'Joko Susilo',
      password: hashedPassword,
      role: Role.STAFF,
      primaryUnitId: pertashop.id,
      tenantId: tenant.id,
    },
  })

  console.log('✅ Users created')

  // ============================================================
  // PERTASHOP — PRODUK BBM
  // ============================================================
  await prisma.fuelProduct.upsert({
    where: { id: 'fuel-pertamax' },
    update: {},
    create: {
      id: 'fuel-pertamax',
      name: 'Pertamax',
      buyPrice: 12000,
      sellPrice: 13000,
      stock: 0,
      unitId: pertashop.id,
    },
  })

  console.log('✅ Produk BBM Pertashop created')

  // ============================================================
  // CATEGORIES
  // ============================================================
  const catBahanBaku = await prisma.category.upsert({
    where: { id: 'cat-bahan-baku' },
    update: {},
    create: { id: 'cat-bahan-baku', name: 'Bahan Baku', unitType: UnitType.RETAIL },
  })

  const catMinuman = await prisma.category.upsert({
    where: { id: 'cat-minuman' },
    update: {},
    create: { id: 'cat-minuman', name: 'Minuman', unitType: UnitType.RETAIL },
  })

  const catSnack = await prisma.category.upsert({
    where: { id: 'cat-snack' },
    update: {},
    create: { id: 'cat-snack', name: 'Snack & Makanan', unitType: UnitType.RETAIL },
  })

  console.log('✅ Categories created')

  // ============================================================
  // PRODUK — TOKO
  // ============================================================
  const produkToko = await Promise.all([
    prisma.product.upsert({
      where: { id: 'prod-beras' },
      update: {},
      create: {
        id: 'prod-beras',
        name: 'Beras Premium',
        sku: 'TK-001',
        unit: 'kg',
        costPrice: 11000,
        sellPrice: 13500,
        stock: 500,
        minStock: 50,
        unitId: toko.id,
        categoryId: catBahanBaku.id,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-minyak' },
      update: {},
      create: {
        id: 'prod-minyak',
        name: 'Minyak Goreng Tropical 2L',
        sku: 'TK-002',
        unit: 'botol',
        costPrice: 28000,
        sellPrice: 32000,
        stock: 120,
        minStock: 20,
        unitId: toko.id,
        categoryId: catBahanBaku.id,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-gula' },
      update: {},
      create: {
        id: 'prod-gula',
        name: 'Gula Pasir',
        sku: 'TK-003',
        unit: 'kg',
        costPrice: 13000,
        sellPrice: 15000,
        stock: 200,
        minStock: 30,
        unitId: toko.id,
        categoryId: catBahanBaku.id,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-teh' },
      update: {},
      create: {
        id: 'prod-teh',
        name: 'Teh Botol Sosro 500ml',
        sku: 'TK-004',
        unit: 'botol',
        costPrice: 3500,
        sellPrice: 5000,
        stock: 240,
        minStock: 48,
        unitId: toko.id,
        categoryId: catMinuman.id,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-kerupuk' },
      update: {},
      create: {
        id: 'prod-kerupuk',
        name: 'Kerupuk Udang 250g',
        sku: 'TK-005',
        unit: 'bungkus',
        costPrice: 8000,
        sellPrice: 12000,
        stock: 80,
        minStock: 15,
        unitId: toko.id,
        categoryId: catSnack.id,
      },
    }),
  ])

  console.log('✅ Produk Toko created')

  // ============================================================
  // PRODUK — RESTORAN (bahan baku dapur, beli dari toko via B2B)
  // ============================================================
  const produkRestoran = await Promise.all([
    prisma.product.upsert({
      where: { id: 'prod-r-beras' },
      update: {},
      create: {
        id: 'prod-r-beras',
        name: 'Beras (Stok Restoran)',
        sku: 'RS-001',
        unit: 'kg',
        costPrice: 13500,
        sellPrice: 13500,
        stock: 50,
        minStock: 10,
        unitId: restoran.id,
        categoryId: catBahanBaku.id,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-r-minyak' },
      update: {},
      create: {
        id: 'prod-r-minyak',
        name: 'Minyak Goreng (Stok Restoran)',
        sku: 'RS-002',
        unit: 'liter',
        costPrice: 16000,
        sellPrice: 16000,
        stock: 20,
        minStock: 5,
        unitId: restoran.id,
        categoryId: catBahanBaku.id,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-r-ayam' },
      update: {},
      create: {
        id: 'prod-r-ayam',
        name: 'Ayam Potong',
        sku: 'RS-003',
        unit: 'kg',
        costPrice: 35000,
        sellPrice: 35000,
        stock: 15,
        minStock: 5,
        unitId: restoran.id,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-r-tahu' },
      update: {},
      create: {
        id: 'prod-r-tahu',
        name: 'Tahu Putih',
        sku: 'RS-004',
        unit: 'buah',
        costPrice: 1500,
        sellPrice: 1500,
        stock: 100,
        minStock: 20,
        unitId: restoran.id,
      },
    }),
  ])

  console.log('✅ Produk Restoran created')

  // ============================================================
  // SUPPLIER
  // ============================================================
  await prisma.supplier.upsert({
    where: { id: 'sup-001' },
    update: {},
    create: {
      id: 'sup-001',
      name: 'CV. Maju Bersama',
      contact: 'Pak Hendra',
      phone: '0813-1111-2222',
      address: 'Gudang Raya No. 10, Kota',
      unitId: toko.id,
    },
  })

  await prisma.supplier.upsert({
    where: { id: 'sup-002' },
    update: {},
    create: {
      id: 'sup-002',
      name: 'UD. Sumber Pangan',
      contact: 'Bu Yanti',
      phone: '0813-3333-4444',
      address: 'Pasar Induk Blok C No. 5',
      unitId: restoran.id,
    },
  })

  console.log('✅ Suppliers created')

  // ============================================================
  // FACILITIES
  // ============================================================
  const facilities = await Promise.all([
    prisma.facility.upsert({ where: { id: 'fac-ac' }, update: {}, create: { id: 'fac-ac', name: 'AC', icon: 'wind' } }),
    prisma.facility.upsert({ where: { id: 'fac-wifi' }, update: {}, create: { id: 'fac-wifi', name: 'WiFi', icon: 'wifi' } }),
    prisma.facility.upsert({ where: { id: 'fac-tv' }, update: {}, create: { id: 'fac-tv', name: 'TV', icon: 'tv' } }),
    prisma.facility.upsert({ where: { id: 'fac-kamar-mandi' }, update: {}, create: { id: 'fac-kamar-mandi', name: 'Kamar Mandi Dalam', icon: 'bath' } }),
    prisma.facility.upsert({ where: { id: 'fac-dapur' }, update: {}, create: { id: 'fac-dapur', name: 'Dapur', icon: 'utensils' } }),
    prisma.facility.upsert({ where: { id: 'fac-parkir' }, update: {}, create: { id: 'fac-parkir', name: 'Parkir', icon: 'car' } }),
    prisma.facility.upsert({ where: { id: 'fac-kolam' }, update: {}, create: { id: 'fac-kolam', name: 'Kolam Renang', icon: 'droplets' } }),
    prisma.facility.upsert({ where: { id: 'fac-sarapan' }, update: {}, create: { id: 'fac-sarapan', name: 'Sarapan', icon: 'coffee' } }),
  ])

  console.log('✅ Facilities created')

  // ============================================================
  // ROOM TYPES
  // ============================================================
  const rtStandard = await prisma.roomType.upsert({
    where: { id: 'rt-standard' },
    update: {},
    create: { id: 'rt-standard', name: 'Standard', capacity: 2 },
  })

  const rtDeluxe = await prisma.roomType.upsert({
    where: { id: 'rt-deluxe' },
    update: {},
    create: { id: 'rt-deluxe', name: 'Deluxe', capacity: 2 },
  })

  const rtVilla = await prisma.roomType.upsert({
    where: { id: 'rt-villa' },
    update: {},
    create: { id: 'rt-villa', name: 'Villa', description: 'Unit mandiri dengan fasilitas lengkap', capacity: 6 },
  })

  console.log('✅ Room types created')

  // ============================================================
  // ROOMS — HOMESTAY (villa/rumah, fasilitas lengkap, harga flat)
  // ============================================================
  const villaA = await prisma.room.upsert({
    where: { id: 'room-hs-villa-a' },
    update: {},
    create: {
      id: 'room-hs-villa-a',
      name: 'Villa Melati',
      status: RoomStatus.AVAILABLE,
      unitId: homestay.id,
      roomTypeId: rtVilla.id,
      description: '2 kamar tidur, ruang tamu, dapur lengkap, halaman privat',
      facilities: {
        create: [
          { facilityId: 'fac-ac' },
          { facilityId: 'fac-wifi' },
          { facilityId: 'fac-tv' },
          { facilityId: 'fac-kamar-mandi' },
          { facilityId: 'fac-dapur' },
          { facilityId: 'fac-parkir' },
          { facilityId: 'fac-kolam' },
        ],
      },
      pricing: {
        create: [
          { dayType: PricingDayType.WEEKDAY, price: 500000, label: 'Weekday' },
          { dayType: PricingDayType.WEEKEND, price: 700000, label: 'Weekend' },
          {
            dayType: PricingDayType.HOLIDAY,
            price: 900000,
            label: 'Lebaran 2025',
            startDate: new Date('2025-03-28'),
            endDate: new Date('2025-04-06'),
          },
        ],
      },
    },
  })

  const villaB = await prisma.room.upsert({
    where: { id: 'room-hs-villa-b' },
    update: {},
    create: {
      id: 'room-hs-villa-b',
      name: 'Villa Kenanga',
      status: RoomStatus.AVAILABLE,
      unitId: homestay.id,
      roomTypeId: rtVilla.id,
      description: '3 kamar tidur, ruang keluarga, dapur, taman',
      facilities: {
        create: [
          { facilityId: 'fac-ac' },
          { facilityId: 'fac-wifi' },
          { facilityId: 'fac-tv' },
          { facilityId: 'fac-kamar-mandi' },
          { facilityId: 'fac-dapur' },
          { facilityId: 'fac-parkir' },
          { facilityId: 'fac-sarapan' },
        ],
      },
      pricing: {
        create: [
          { dayType: PricingDayType.WEEKDAY, price: 650000, label: 'Weekday' },
          { dayType: PricingDayType.WEEKEND, price: 850000, label: 'Weekend' },
        ],
      },
    },
  })

  console.log('✅ Homestay rooms created')

  // ============================================================
  // ROOMS — PENGINAPAN (kamar standar, harga dinamis weekend/weekday)
  // ============================================================
  const kamar101 = await prisma.room.upsert({
    where: { id: 'room-pg-101' },
    update: {},
    create: {
      id: 'room-pg-101',
      name: '101',
      floor: 1,
      status: RoomStatus.AVAILABLE,
      unitId: penginapan.id,
      roomTypeId: rtStandard.id,
      facilities: {
        create: [
          { facilityId: 'fac-ac' },
          { facilityId: 'fac-wifi' },
          { facilityId: 'fac-tv' },
          { facilityId: 'fac-kamar-mandi' },
        ],
      },
      pricing: {
        create: [
          { dayType: PricingDayType.WEEKDAY, price: 200000 },
          { dayType: PricingDayType.WEEKEND, price: 275000 },
        ],
      },
    },
  })

  const kamar102 = await prisma.room.upsert({
    where: { id: 'room-pg-102' },
    update: {},
    create: {
      id: 'room-pg-102',
      name: '102',
      floor: 1,
      status: RoomStatus.OCCUPIED,
      unitId: penginapan.id,
      roomTypeId: rtStandard.id,
      facilities: {
        create: [
          { facilityId: 'fac-ac' },
          { facilityId: 'fac-wifi' },
          { facilityId: 'fac-tv' },
          { facilityId: 'fac-kamar-mandi' },
        ],
      },
      pricing: {
        create: [
          { dayType: PricingDayType.WEEKDAY, price: 200000 },
          { dayType: PricingDayType.WEEKEND, price: 275000 },
        ],
      },
    },
  })

  const kamar201 = await prisma.room.upsert({
    where: { id: 'room-pg-201' },
    update: {},
    create: {
      id: 'room-pg-201',
      name: '201',
      floor: 2,
      status: RoomStatus.AVAILABLE,
      unitId: penginapan.id,
      roomTypeId: rtDeluxe.id,
      facilities: {
        create: [
          { facilityId: 'fac-ac' },
          { facilityId: 'fac-wifi' },
          { facilityId: 'fac-tv' },
          { facilityId: 'fac-kamar-mandi' },
          { facilityId: 'fac-sarapan' },
        ],
      },
      pricing: {
        create: [
          { dayType: PricingDayType.WEEKDAY, price: 300000 },
          { dayType: PricingDayType.WEEKEND, price: 400000 },
          {
            dayType: PricingDayType.HOLIDAY,
            price: 500000,
            label: 'High Season',
            startDate: new Date('2025-06-15'),
            endDate: new Date('2025-08-31'),
          },
        ],
      },
    },
  })

  console.log('✅ Penginapan rooms created')

  // ============================================================
  // MENU CATEGORIES & MENU ITEMS — RESTORAN
  // ============================================================
  const mcMakanan = await prisma.menuCategory.upsert({
    where: { id: 'mc-makanan' },
    update: {},
    create: { id: 'mc-makanan', name: 'Makanan' },
  })

  const mcMinuman = await prisma.menuCategory.upsert({
    where: { id: 'mc-minuman' },
    update: {},
    create: { id: 'mc-minuman', name: 'Minuman' },
  })

  const mcPaket = await prisma.menuCategory.upsert({
    where: { id: 'mc-paket' },
    update: {},
    create: { id: 'mc-paket', name: 'Paket Hemat' },
  })

  const menuItems = await Promise.all([
    prisma.menuItem.upsert({
      where: { id: 'menu-nasi-ayam' },
      update: {},
      create: {
        id: 'menu-nasi-ayam',
        name: 'Nasi Ayam Goreng',
        description: 'Nasi putih + ayam goreng crispy + lalapan',
        price: 25000,
        taxRate: 11,
        unitId: restoran.id,
        menuCategoryId: mcMakanan.id,
        ingredients: {
          create: [
            { productId: 'prod-r-beras', qtyUsed: 0.25 },   // 250g beras
            { productId: 'prod-r-minyak', qtyUsed: 0.05 },  // 50ml minyak
            { productId: 'prod-r-ayam', qtyUsed: 0.25 },    // 250g ayam
          ],
        },
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 'menu-nasi-tahu' },
      update: {},
      create: {
        id: 'menu-nasi-tahu',
        name: 'Nasi Tahu Tempe',
        description: 'Nasi + tahu goreng + tempe + sambal',
        price: 15000,
        taxRate: 11,
        unitId: restoran.id,
        menuCategoryId: mcMakanan.id,
        ingredients: {
          create: [
            { productId: 'prod-r-beras', qtyUsed: 0.25 },
            { productId: 'prod-r-minyak', qtyUsed: 0.03 },
            { productId: 'prod-r-tahu', qtyUsed: 2 },
          ],
        },
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 'menu-es-teh' },
      update: {},
      create: {
        id: 'menu-es-teh',
        name: 'Es Teh Manis',
        price: 5000,
        taxRate: 0,
        unitId: restoran.id,
        menuCategoryId: mcMinuman.id,
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 'menu-es-jeruk' },
      update: {},
      create: {
        id: 'menu-es-jeruk',
        name: 'Es Jeruk Peras',
        price: 8000,
        taxRate: 0,
        unitId: restoran.id,
        menuCategoryId: mcMinuman.id,
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 'menu-paket-a' },
      update: {},
      create: {
        id: 'menu-paket-a',
        name: 'Paket Hemat A',
        description: 'Nasi Ayam Goreng + Es Teh Manis',
        price: 28000,
        taxRate: 11,
        unitId: restoran.id,
        menuCategoryId: mcPaket.id,
      },
    }),
  ])

  console.log('✅ Menu items created')

  // ============================================================
  // EMPLOYEES
  // ============================================================
  await prisma.employee.upsert({
    where: { id: 'emp-001' },
    update: {},
    create: {
      id: 'emp-001',
      name: 'Sari Dewi',
      phone: '0812-5555-0001',
      position: 'Manager Toko',
      primaryUnitId: toko.id,
      userId: managerToko.id,
      joinDate: new Date('2022-01-15'),
      salary: 4500000,
    },
  })

  await prisma.employee.upsert({
    where: { id: 'emp-002' },
    update: {},
    create: {
      id: 'emp-002',
      name: 'Andi Pratama',
      phone: '0812-5555-0002',
      position: 'Kasir Restoran',
      primaryUnitId: restoran.id,
      userId: kasirRestoran.id,
      joinDate: new Date('2023-03-01'),
      salary: 3000000,
    },
  })

  await prisma.employee.upsert({
    where: { id: 'emp-003' },
    update: {},
    create: {
      id: 'emp-003',
      name: 'Rina Wati',
      phone: '0812-5555-0003',
      position: 'Staff Homestay',
      primaryUnitId: homestay.id,
      userId: staffHomestay.id,
      joinDate: new Date('2023-06-01'),
      salary: 2500000,
    },
  })

  await prisma.employee.upsert({
    where: { id: 'emp-004' },
    update: {},
    create: {
      id: 'emp-004',
      name: 'Doni Kusuma',
      phone: '0812-5555-0004',
      position: 'Staff Penginapan',
      primaryUnitId: penginapan.id,
      joinDate: new Date('2024-01-10'),
      salary: 2500000,
    },
  })

  console.log('✅ Employees created')

  // ============================================================
  // SAMPLE BOOKING — PENGINAPAN (kamar 102 sedang OCCUPIED)
  // ============================================================
  await prisma.booking.upsert({
    where: { bookingCode: 'BK-PG-001' },
    update: {},
    create: {
      bookingCode: 'BK-PG-001',
      guestName: 'Rudi Hartono',
      guestPhone: '0812-9999-0001',
      guestIdNum: '3201010101800001',
      checkIn: new Date('2025-06-08'),
      checkOut: new Date('2025-06-10'),
      totalNights: 2,
      pricePerNight: 200000,
      totalPrice: 400000,
      dpAmount: 200000,
      paidAmount: 200000,
      status: 'CHECKED_IN',
      source: 'walk-in',
      roomId: kamar102.id,
      unitId: penginapan.id,
      payments: {
        create: {
          amount: 200000,
          method: 'CASH',
          type: 'DP',
          note: 'DP check-in',
        },
      },
    },
  })

  console.log('✅ Sample booking created')

  console.log('\n🎉 Seeding completed!')
  console.log('\n📋 Login credentials:')
  console.log('   Owner  : owner@bisnis.com / password123')
  console.log('   Manager: manager.toko@bisnis.com / password123')
  console.log('   Kasir  : kasir.resto@bisnis.com / password123')
  console.log('   Staff  : staff.homestay@bisnis.com / password123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
