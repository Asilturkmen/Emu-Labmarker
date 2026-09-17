# EMU LabMark

EMU öğrenci portalındaki ders programında laboratuvar derslerini ilk bakışta
görünür kılan bir tarayıcı eklentisi.

Ders programı bütün dersleri aynı renkte gösterdiği için labları ayırt etmek oda
kodlarını ezbere bilmeyi gerektiriyor. EMU LabMark laboratuvar derslerini renkli
bir çerçeve ve kısa bir etiketle işaretler. Hangi dersin lab olduğunu tahmin
etmez; yalnızca doğrulanmış laboratuvar odalarını işaretler.

> Kapsam: şu an bilgisayar mühendisliği (CMPE) laboratuvarları.

## Neleri işaretler

| | Lab sınıfı | Özel lab |
| --- | --- | --- |
| Kaynak | Eklentiyle gelen doğrulanmış liste | Kendi eklediğin sınıflar |
| Etiket | `LAB SINIFI` | `ÖZEL LAB` |
| Renk | Kırmızı | Turuncu |

Ders programının altına, o programda gerçekten bulunan işaret türlerini anlatan
bir açıklama satırı eklenir.

## Kurulum

Eklenti henüz mağazada yayında değil. Kullanmak için:

```bash
npm install
npm run build
```

Ardından Chrome'da `chrome://extensions` adresini aç, **Geliştirici modu**'nu
etkinleştir, **Paketlenmemiş öğe yükle**'ye bas ve `.output/chrome-mv3`
klasörünü seç.

## Kullanım

**Aç / kapa** — Eklenti simgesine tıkla ve anahtarı kullan. Kapattığında
işaretler anında kalkar, ders programı olduğu gibi kalır.

**Kendi lab sınıfını ekleme** — Bir hoca normalde lab olmayan bir sınıfı o dönem
lab olarak kullanıyorsa, oda kodunu popup'taki listeye ekle. `CMPE025` gibi bir
oda kodu da, ders programından kopyaladığın `CMSE423/CMPE025` gibi bir giriş de
kabul edilir. Bu sınıflar turuncu renkte ve `ÖZEL LAB` etiketiyle görünür,
doğrulanmış laboratuvarlarla karışmaz. Listeden çıkarmak için çipteki × işaretine
bas.

Her değişiklik açık sekmelere anında yansır; sayfayı yenilemek gerekmez.

## Gizlilik

Eklenti yalnızca ders programı sayfasını okur. Hiçbir veri toplanmaz ve hiçbir
yere gönderilmez. İstenen tek izin `storage`; o da aç/kapa tercihini ve kendi
eklediğin sınıfların listesini yalnızca senin tarayıcında saklamak için
kullanılır.

## Laboratuvar listesini genişletmek

Doğrulanmış odalar `src/data/labRooms.ts` dosyasındaki listede durur. Yeni bir
oda için listeye oda kodunu eklemek yeterlidir; boşluk ve harf büyüklüğü fark
etmez. Listeye yalnızca gerçekten laboratuvar olduğu doğrulanmış odalar girer —
şüpheli bir oda, kullanıcının kendi ekleyebildiği özel lab listesine aittir.

## Geliştirme

| Komut | |
| --- | --- |
| `npm run dev` | Geliştirme modu, canlı yeniden yükleme ile |
| `npm run build` | `.output/chrome-mv3` altına derleme |
| `npm run zip` | Mağazaya yüklenebilir arşiv |
| `npm test` | Testler |
| `npm run typecheck` | Tip denetimi |

WXT ve TypeScript ile yazıldı, Manifest V3. İçerik betiği ders programındaki
dersleri okur, oda kodlarını iki listeyle karşılaştırır ve eşleşenleri
işaretler. Portal programı kademeli yüklediği için sayfadaki değişiklikler
izlenir ve gerektiğinde yeniden taranır.

## Lisans

MIT — ayrıntılar için [LICENSE](LICENSE).
