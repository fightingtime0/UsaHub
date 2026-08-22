// Konfirmasi reservasi lewat WhatsApp memakai deep link wa.me — bukan Twilio/API berbayar.
// Alasan: volume reservasi kecil, dan wa.me tidak butuh kredensial, nomor bisnis terverifikasi,
// biaya per pesan, maupun webhook. Pemesan menekan tombol, WhatsApp terbuka dengan teks
// sudah terisi, lalu dia sendiri yang menekan kirim ke operator.
// ponytail: satu arah (pemesan -> operator). Kalau nanti butuh balasan otomatis/broadcast,
// barulah naik ke WhatsApp Cloud API.

// Ubah nomor lokal Indonesia ke format internasional tanpa "+" (yang diminta wa.me).
// "0812-3456-7890" -> "6281234567890", "+62 812 ..." -> "62812...", "62812..." tetap.
export function toWaNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null

  let n = digits
  if (n.startsWith('0')) n = '62' + n.slice(1)
  else if (n.startsWith('8')) n = '62' + n // orang sering menulis tanpa 0 di depan
  else if (!n.startsWith('62')) return null // nomor luar negeri / salah ketik — jangan ditebak

  // 62 + 9..13 digit. Lebih pendek/panjang dari itu pasti salah ketik.
  if (n.length < 11 || n.length > 15) return null
  return n
}

export function waLink(phone: string, message: string): string | null {
  const n = toWaNumber(phone)
  if (!n) return null
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`
}

type ReservasiPesan = {
  orderCode: string
  travelName: string | null
  customerName: string
  busPo: string | null
  eventDate: Date | string
  pax: number
  menuType: string
  pricePerPax: number
  totalPrice: number
  customMenu?: string | null
}

const fmtRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

// Teks yang sudah terisi di WhatsApp — sengaja meniru format form cetak Kopi Telo
// supaya operator bisa langsung baca/salin tanpa membuka dashboard.
export function reservasiWaText(r: ReservasiPesan, unitName: string): string {
  const d = new Date(r.eventDate)
  const tanggal = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

  return [
    `*FORM RESERVASI ${unitName.toUpperCase()}*`,
    `Kode: ${r.orderCode}`,
    '',
    `NAMA TRAVEL       : ${r.travelName ?? '-'}`,
    `NAMA ROMBONGAN    : ${r.customerName}`,
    `PO BUS            : ${r.busPo ?? '-'}`,
    `TANGGAL           : ${tanggal}`,
    `JAM               : ${jam}`,
    `MENU MAKAN        : ${r.menuType} (${fmtRp(r.pricePerPax)}/org)`,
    `JUMLAH PESERTA    : ${r.pax} orang`,
    `TOTAL             : ${fmtRp(r.totalPrice)}`,
    ...(r.customMenu ? ['', `Catatan: ${r.customMenu}`] : []),
    '',
    'Mohon konfirmasi ketersediaannya. Terima kasih.',
  ].join('\n')
}
