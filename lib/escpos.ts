import type { ReceiptData } from '@/components/receipt'

// Generate perintah ESC/POS mentah untuk struk 58mm (32 kolom), lalu kirim
// ke app RawBT (https://www.rawbt.ru) via Android Intent — RawBT yang urus
// pairing & pengiriman ke printer thermal Bluetooth apapun (Classic SPP maupun BLE).
// Hanya jalan di Chrome/Edge Android dengan RawBT terinstall.

const WIDTH = 32

const ESC = 0x1b
const GS = 0x1d

const CMD = {
  INIT: [ESC, 0x40],
  ALIGN_LEFT: [ESC, 0x61, 0],
  ALIGN_CENTER: [ESC, 0x61, 1],
  BOLD_ON: [ESC, 0x45, 1],
  BOLD_OFF: [ESC, 0x45, 0],
  DOUBLE_ON: [ESC, 0x21, 0x30],
  DOUBLE_OFF: [ESC, 0x21, 0x00],
  CUT: [GS, 0x56, 66, 0],
  FEED: [0x0a],
}

const PAYMENT_LABEL: Record<string, string> = {
  CASH: 'Tunai', QRIS: 'QRIS', TRANSFER: 'Transfer', CARD: 'Kartu', OTHER: 'Lainnya',
}

function num(n: number): string {
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(Math.round(n))
}

function twoCol(left: string, right: string, width = WIDTH): string {
  const space = Math.max(1, width - left.length - right.length)
  return left + ' '.repeat(space) + right
}

class EscPosBuilder {
  private bytes: number[] = []

  raw(cmd: number[]) {
    this.bytes.push(...cmd)
    return this
  }

  text(s: string) {
    this.bytes.push(...Array.from(new TextEncoder().encode(s)))
    return this
  }

  line(s = '') {
    return this.text(s).raw(CMD.FEED)
  }

  center(s: string) {
    return this.raw(CMD.ALIGN_CENTER).line(s).raw(CMD.ALIGN_LEFT)
  }

  bold(s: string) {
    return this.raw(CMD.BOLD_ON).line(s).raw(CMD.BOLD_OFF)
  }

  divider(char = '-') {
    return this.line(char.repeat(WIDTH))
  }

  toBytes(): Uint8Array {
    return new Uint8Array(this.bytes)
  }
}

export function buildEscPosReceipt(data: ReceiptData): Uint8Array {
  const b = new EscPosBuilder().raw(CMD.INIT)

  b.raw(CMD.ALIGN_CENTER)
  b.raw(CMD.DOUBLE_ON).line(data.storeName.toUpperCase()).raw(CMD.DOUBLE_OFF)
  if (data.storeLocation) b.line(data.storeLocation)
  b.raw(CMD.ALIGN_LEFT)

  b.divider('=')
  b.line(`No : ${data.invoiceNumber}`)
  b.line(`Tgl: ${typeof data.dateTime === 'string' ? data.dateTime : data.dateTime.toLocaleString('id-ID')}`)
  b.divider('-')

  for (const it of data.items) {
    b.line(it.name)
    b.line(twoCol(`${it.qty} x ${num(it.price)}`, num(it.subtotal)))
  }

  b.divider('-')
  b.line(twoCol('Subtotal', num(data.subtotal)))
  if ((data.discount ?? 0) > 0) b.line(twoCol('Diskon', `-${num(data.discount!)}`))
  if ((data.tax ?? 0) > 0) b.line(twoCol('Pajak', num(data.tax!)))
  b.bold(twoCol('TOTAL', num(data.total)))

  if (data.paymentMethod) {
    b.line(twoCol(`Bayar (${PAYMENT_LABEL[data.paymentMethod] ?? data.paymentMethod})`, num(data.paidAmount ?? data.total)))
  }
  if ((data.change ?? 0) > 0) b.line(twoCol('Kembalian', num(data.change!)))

  b.divider('=')
  b.raw(CMD.ALIGN_CENTER)
  b.line(data.footerNote ?? 'Terima kasih atas kunjungan Anda')
  b.raw(CMD.ALIGN_LEFT)

  b.raw(CMD.FEED).raw(CMD.FEED).raw(CMD.FEED)
  b.raw(CMD.CUT)

  return b.toBytes()
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

// Kirim struk ke printer thermal Bluetooth via app RawBT (harus terinstall di tablet).
// https://www.rawbt.ru/download — dokumentasi integrasi via Android Intent dari browser.
export function printViaRawBT(data: ReceiptData) {
  const base64 = bytesToBase64(buildEscPosReceipt(data))
  const intentUrl = `intent:base64,${base64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`
  window.location.href = intentUrl
}
