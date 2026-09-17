# EMU LabMark

EMU öğrenci portalındaki ders programında (`student.emu.edu.tr/Academic/TimeTable`)
laboratuvar derslerini işaretleyen bir tarayıcı eklentisi. Hangi dersin lab olduğu
tahmin edilmez; yalnızca elle doğrulanmış oda listesindeki odalar işaretlenir.

## Kurulum (geliştirme)

```bash
npm install
npm run dev       # Chrome'u eklenti yüklenmiş olarak açar
```

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme modu, canlı yeniden yükleme ile |
| `npm run build` | `.output/chrome-mv3` altına üretim derlemesi |
| `npm run zip` | Mağazaya yüklenebilir arşiv |
| `npm test` | Vitest testleri (jsdom) |
| `npm run typecheck` | `wxt prepare` + `tsc --noEmit` |

## Lab odası ekleme

Tek veri kaynağı `src/data/labRooms.ts` içindeki `VERIFIED_LAB_ROOMS` listesidir.
Yeni bir oda eklemek için listeye oda kodunu yazmak yeterli — boşluk ve harf
büyüklüğü aranmadan önce normalize edildiği için `cmpe 134` ile `CMPE134` aynıdır.

```ts
export const VERIFIED_LAB_ROOMS: ReadonlySet<string> = new Set([
  "CMPE134",
  "CMPE230",
]);
```

Listeye yalnızca gerçekten lab olduğu **elle doğrulanmış** odalar girer.

## Nasıl çalışıyor

İçerik betiği (`entrypoints/content.ts`) şu hattı işletir:

1. **`src/parser/parseTimetable.ts`** — Ders programındaki bağlantıları tarar,
   `COURSE/ROOM` biçimini, gün ve saat bilgisini çıkarır. Portalın hem masaüstü
   (UL/LI) hem mobil düzenini ve İngilizce/Türkçe gün adlarını tanır.
2. **`src/grouping/groupMeetingBlocks.ts`** — Aynı ders/gün/odaya ait ardışık
   saat satırlarını (aradaki 10 dakikalık teneffüs dahil) tek bloğa birleştirir.
3. **`src/resolver/resolveMeetings.ts`** — Her bloğun odasını doğrulanmış oda
   listesiyle karşılaştırır.
4. **`src/highlighter/highlightTimetable.ts`** — Hücreyi işaretler, "LAB"
   etiketini ve tablo altındaki renk açıklamasını ekler. Portal dersleri
   bağlantı olarak değil düz metin olarak render ettiğinde
   `highlightVerifiedRoomText` yedeği devreye girer.

Portalın kendi JavaScript'i programı kademeli render ettiği için bir
`MutationObserver` değişiklikleri izler ve kısa bir gecikmeyle tek bir yeniden
tarama yapar.

Eklenti aç/kapa durumu `browser.storage.local` içinde tutulur
(`src/settings.ts`); popup bunu değiştirir, içerik betiği anında tepki verir.

## Gizlilik

Eklenti yalnızca ders programı sayfasının DOM'unu okur. Hiçbir veri toplanmaz,
saklanmaz veya dışarıya gönderilmez; tek istenen izin, aç/kapa tercihini
saklamak için `storage`.
