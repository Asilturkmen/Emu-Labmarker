# EMU LabMark

EMU öğrenci portalındaki ders programında (`student.emu.edu.tr/Academic/TimeTable`)
laboratuvar derslerini işaretleyen bir tarayıcı eklentisi. Hangi dersin lab olduğu
tahmin edilmez; yalnızca bilinen oda listelerindeki odalar işaretlenir.

İki tür işaret var:

| | Kesin lab | Özel lab |
| --- | --- | --- |
| Kaynak | Eklentiyle gelen doğrulanmış liste | Kullanıcının popup'tan eklediği liste |
| Etiket | `LAB SINIFI` | `ÖZEL LAB SINIFI` |
| Renk | Kırmızı (`#f12e4b`) | Teal (`#0ea5a4`) |

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

### Kesin lab (kod içinde)

Doğrulanmış odalar `src/data/labRooms.ts` içindeki `VERIFIED_LAB_ROOMS`
listesinde durur. Yeni bir oda eklemek için listeye oda kodunu yazmak yeterli —
boşluk ve harf büyüklüğü aranmadan önce normalize edildiği için `cmpe 134` ile
`CMPE134` aynıdır.

```ts
export const VERIFIED_LAB_ROOMS: ReadonlySet<string> = new Set([
  "CMPE134",
  "CMPE230",
]);
```

Listeye yalnızca gerçekten lab olduğu **elle doğrulanmış** odalar girer.

### Özel lab (kullanıcı tarafından)

Normalde lab olmayan bir sınıf o dönem lab olarak kullanılabiliyor. Kullanıcı
eklenti simgesine tıklayıp kendi listesini tutar; bu odalar **teal** renkte ve
`ÖZEL LAB SINIFI` etiketiyle görünür, kesin lablarla karışmaz.

- Oda kodu (`CMPE025`) ya da programdan kopyalanmış bir giriş
  (`CMSE423/CMPE025`) yazılabilir; ikisi de `CMPE025` olarak kaydedilir.
- Kesin lab listesinde olan bir oda eklenmek istenirse popup uyarır; oda iki
  listede de bulunuyorsa kesin lab gösterimi kazanır.
- Liste `browser.storage.local` içinde `emuLabmarkCustomRooms` anahtarında
  tutulur (`src/settings.ts`), en fazla 50 oda. İçerik betiği değişikliği
  anında dinler, sayfayı yenilemek gerekmez.

## Nasıl çalışıyor

İçerik betiği (`entrypoints/content.ts`) şu hattı işletir:

1. **`src/parser/parseTimetable.ts`** — Ders programındaki bağlantıları tarar,
   `COURSE/ROOM` biçimini, gün ve saat bilgisini çıkarır. Portalın hem masaüstü
   (UL/LI) hem mobil düzenini ve İngilizce/Türkçe gün adlarını tanır.
2. **`src/grouping/groupMeetingBlocks.ts`** — Aynı ders/gün/odaya ait ardışık
   saat satırlarını (aradaki 10 dakikalık teneffüs dahil) tek bloğa birleştirir.
3. **`src/resolver/resolveMeetings.ts`** — Her bloğun odasını iki oda listesiyle
   karşılaştırır; sıra: kesin lab → özel lab → işaretsiz.
4. **`src/highlighter/highlightTimetable.ts`** — Hücreyi işaretler, etiketi ve
   tablo altındaki renk açıklamasını ekler. Açıklama yalnızca o programda
   gerçekten bulunan türleri listeler. Portal dersleri bağlantı olarak değil düz
   metin olarak render ettiğinde `highlightLabRoomText` yedeği devreye girer.

Portalın kendi JavaScript'i programı kademeli render ettiği için bir
`MutationObserver` değişiklikleri izler ve kısa bir gecikmeyle tek bir yeniden
tarama yapar.

Eklenti aç/kapa durumu ve kullanıcının özel lab listesi
`browser.storage.local` içinde tutulur (`src/settings.ts`); popup bunları
değiştirir, içerik betiği ikisini de anında dinler.

## Gizlilik

Eklenti yalnızca ders programı sayfasının DOM'unu okur. Hiçbir veri toplanmaz
veya dışarıya gönderilmez. Tek istenen izin `storage`; o da yalnızca aç/kapa
tercihini ve kullanıcının kendi özel lab listesini kendi tarayıcısında
saklamak için kullanılır.
