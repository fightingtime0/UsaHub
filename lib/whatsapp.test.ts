// Cek mandiri: npx tsx lib/whatsapp.test.ts
import assert from 'node:assert'
import { toWaNumber, waLink, reservasiWaText } from './whatsapp'

assert.equal(toWaNumber('0812-3456-7890'), '6281234567890')
assert.equal(toWaNumber('+62 812 3456 7890'), '6281234567890')
assert.equal(toWaNumber('6281234567890'), '6281234567890')
assert.equal(toWaNumber('81234567890'), '6281234567890') // ditulis tanpa 0 di depan
assert.equal(toWaNumber('08123456789'), '628123456789')  // 11 digit, batas bawah

assert.equal(toWaNumber(''), null)
assert.equal(toWaNumber('-'), null)
assert.equal(toWaNumber('081'), null)                    // terlalu pendek
assert.equal(toWaNumber('0812345678901234'), null)       // terlalu panjang
assert.equal(toWaNumber('+1 555 123 4567'), null)        // bukan nomor Indonesia, jangan ditebak

assert.equal(waLink('081', 'halo'), null)
assert.equal(waLink('081234567890', 'a b'), 'https://wa.me/6281234567890?text=a%20b')

const teks = reservasiWaText(
  {
    orderCode: 'RSV-1',
    travelName: 'LetsGo Tour Jogja',
    customerName: 'Aida',
    busPo: null,
    eventDate: new Date('2026-08-27T11:30:00'),
    pax: 32,
    menuType: 'Paket P',
    pricePerPax: 32000,
    totalPrice: 1024000,
  },
  'Kopi Telo'
)
assert.ok(teks.includes('LetsGo Tour Jogja'))
assert.ok(teks.includes('PO BUS            : -'))
assert.ok(teks.includes('32 orang'))
assert.ok(teks.includes('Rp 1.024.000'))

console.log('whatsapp: ok')
