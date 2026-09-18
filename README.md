<h1 align="center">EMU LabMark</h1>

<p align="center">
  EMU öğrenci portalındaki ders programında laboratuvar derslerini
  ilk bakışta görünür kılan bir tarayıcı eklentisi.
</p>

<p align="center">
  <a href="https://github.com/Asilturkmen/Emu-Labmarker/actions/workflows/ci.yml">
    <img src="https://github.com/Asilturkmen/Emu-Labmarker/actions/workflows/ci.yml/badge.svg" alt="CI durumu">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/lisans-MIT-blue.svg" alt="MIT lisansı">
  </a>
  <img src="https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white" alt="Manifest V3">
  <a href="https://buymeacoffee.com/turkmenasil">
    <img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-destek%20ol-FFDD00?logo=buymeacoffee&logoColor=black" alt="Buy Me a Coffee">
  </a>
</p>

---

Ders programı bütün dersleri aynı renkte gösterdiği için labları ayırt etmek oda
kodlarını ezbere bilmeyi gerektiriyor. EMU LabMark laboratuvar derslerini renkli
bir çerçeve ve kısa bir etiketle işaretler. Hangi dersin lab olduğunu tahmin
etmez; yalnızca doğrulanmış laboratuvar odalarını işaretler.

<p align="center">
  <img src="docs/screenshot.png" alt="Laboratuvar dersleri işaretlenmiş EMU ders programı" width="860">
</p>

> **Kimin için:** CMPE ve CMSE kodlu dersleri alan bilgisayar mühendisliği
> öğrencileri. Doğrulanmış laboratuvar listesi şu an bu bölümün
> laboratuvarlarını içeriyor. Başka bir bölümdeysen programında işaretlenecek
> bir oda çıkmayabilir; kendi lab sınıfını pop-up'tan ekleyebilirsin.

> **Not:** Bu bağımsız bir öğrenci projesidir.

## Neleri işaretler

| | Lab sınıfı | Özel lab |
| --- | --- | --- |
| Kaynak | Eklentiyle gelen doğrulanmış liste | Kendi eklediğin sınıflar |
| Etiket | `LAB SINIFI` | `ÖZEL LAB` |
| Renk | Kırmızı | Turuncu |

Bir saatte laboratuvar dersi varsa o hücrenin tamamı işaretlenir, böylece o saat
aralığında lab olup olmadığı tek bakışta görünür. Ders programının altına da, o
programda gerçekten bulunan işaret türlerini anlatan bir açıklama satırı eklenir.

## Kurulum

**Chrome Web Store** — yayına girdiğinde buraya mağaza bağlantısı eklenecek.

**Zip ile** — [Releases](https://github.com/Asilturkmen/Emu-Labmarker/releases)
sayfasından son sürümün zip dosyasını indir ve klasöre çıkar. Chrome'da
`chrome://extensions` adresini aç, sağ üstten **Geliştirici modu**'nu etkinleştir,
**Paketlenmemiş öğe yükle**'ye bas ve çıkardığın klasörü seç.

Kurulumdan sonra ders programı sayfasını yenile.

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

## Eksik bir laboratuvar mı var

Doğrulanmış odalar `src/data/labRooms.ts` dosyasındaki listede durur ve listeye
yalnızca gerçekten laboratuvar olduğu doğrulanmış odalar girer.

- **Kullanıcıysan:** eksik odayı popup'tan özel lab olarak ekleyebilirsin, ya da
  [bir issue aç](https://github.com/Asilturkmen/Emu-Labmarker/issues/new) —
  oda kodunu yazman yeterli.
- **Katkı vereceksen:** oda kodunu listeye ekle ve `npm test` ile doğrula.
  Boşluk ve harf büyüklüğü fark etmez (`cmpe 134` = `CMPE134`).

## Katkı

Pull request'ler açık. Proje WXT ve TypeScript ile yazıldı (Manifest V3).
Göndermeden önce:

```bash
npm install
npm run typecheck && npm test
```

CI aynı adımları (`typecheck`, `test`, `build`) her push'ta yeniden koşar.

## Destek

Eklenti ücretsiz ve açık kaynak. İşine yaradıysa bir kahve ısmarlayabilirsin:

<a href="https://buymeacoffee.com/turkmenasil">
  <img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-turkmenasil-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black" alt="Buy Me a Coffee">
</a>

## Lisans

MIT — ayrıntılar için [LICENSE](LICENSE).
