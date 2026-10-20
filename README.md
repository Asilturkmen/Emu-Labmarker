<p align="center">
  <img src="public/icons/icon-128.png" width="88" alt="EMU LabMarker simgesi">
</p>

<h1 align="center">EMU LabMarker</h1>

<p align="center">
  EMU ders programındaki lab sınıflarını işaretler.
</p>

<p align="center">
  <a href="https://asilturkmen.com"><b>Asil Türkmen</b></a> tarafından geliştirildi.
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/nnggdjkckjilebbheccgoicocnjhiffd?utm_source=item-share-cb"><img src="https://img.shields.io/badge/Chrome%20Web%20Store'dan-Y%C3%BCkle-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Web Store'dan yükle" height="40"></a>
</p>

<p align="center">
  <a href="https://github.com/Asilturkmen/Emu-Labmarker/actions/workflows/ci.yml"><img src="https://github.com/Asilturkmen/Emu-Labmarker/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://chromewebstore.google.com/detail/nnggdjkckjilebbheccgoicocnjhiffd?utm_source=item-share-cb"><img src="https://img.shields.io/chrome-web-store/v/nnggdjkckjilebbheccgoicocnjhiffd?label=Chrome%20Web%20Store&logo=googlechrome&logoColor=white" alt="Chrome Web Store sürümü"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/lisans-MIT-blue.svg" alt="MIT lisansı"></a>
  <a href="https://asilturkmen.com"><img src="https://img.shields.io/badge/asilturkmen.com-ziyaret%20et-17365d" alt="asilturkmen.com"></a>
</p>

<br>

<p align="center">
  <img src="docs/screenshot.png" alt="Lab dersleri kırmızı, kullanıcının eklediği sınıflar turuncu işaretlenmiş EMU ders programı" width="880">
</p>

<br>

EMU portalında tüm dersler aynı renkte görünüyor; lab sınıfları ayrıca belirtilmiyor.
Bu eklentiyi kendi ders programımda lab sınıflarını ayırt etmek için yazdım.

LabMarker, kayıtlı lab sınıflarındaki dersleri kırmızı çerçeve ve `LAB SINIFI`
etiketiyle işaretler. İşaretleme, dersin adına veya türüne değil, oda koduna dayanır.
Kendi eklediğin lab ve tutorial kayıtları da ayrı renklerde gösterilir.

## Kurulum

**[Chrome Web Store sayfasını aç](https://chromewebstore.google.com/detail/nnggdjkckjilebbheccgoicocnjhiffd?utm_source=item-share-cb)**,
**Chrome'a ekle** düğmesine tıkla ve ders programı sayfasını yenile.
Bu şekilde kurduğunda güncellemeler otomatik yüklenir.

<p align="center">
  <a href="https://chromewebstore.google.com/detail/nnggdjkckjilebbheccgoicocnjhiffd?utm_source=item-share-cb"><img src="docs/store-banner.png" alt="EMU LabMarker'ı Chrome Web Store'da aç" width="880"></a>
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/nnggdjkckjilebbheccgoicocnjhiffd?utm_source=item-share-cb"><img src="https://img.shields.io/badge/Chrome%20Web%20Store'dan-Y%C3%BCkle-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Web Store'dan yükle" height="40"></a>
</p>

<details>
<summary>Elle kurulum (Web Store kullanamıyorsan)</summary>

<br>

1. [Releases](https://github.com/Asilturkmen/Emu-Labmarker/releases) sayfasından son zip'i indir, bir klasöre çıkar.
2. `chrome://extensions` adresini aç, sağ üstten **Geliştirici modu**'nu aç.
3. **Paketlenmemiş öğe yükle**'ye bas, çıkardığın klasörü seç.

Sonra ders programı sayfasını bir kez yenile. Bu yolla kurulan sürüm kendiliğinden güncellenmez.

</details>

## Kullanım

<img src="docs/popup.png" align="right" width="250" alt="Eklenti penceresi: aç/kapa anahtarı ve özel lab listesi">

Eklenti, ders programı sayfasını yeniledikten sonra ek ayar gerektirmeden çalışır.
Araç çubuğundaki simgesi ders programı sayfasında renkli, diğer sayfalarda gridir.
Simgeye tıklayarak aşağıdaki ayarlara ulaşabilirsin:

**Aç / kapa.** Eklentiyi kapattığında işaretler kaldırılır.
Değişiklik için sayfayı yenilemen gerekmez.

**Lab sınıfı ekleme.** Listede bulunmayan bir sınıfta lab dersin varsa oda kodunu
yazıp **Ekle** düğmesine tıkla. Eklediğin sınıflar turuncu renkte ve `ÖZEL LAB`
etiketiyle gösterilir. Bir kaydı kaldırmak için yanındaki **×** düğmesine tıkla.

**Belirli bir dersi işaretleme.** Aynı sınıftaki derslerden yalnızca birini işaretlemek
için eklenti penceresini ders programı sayfasında aç ve oda kodunu yaz.
Kodun ilk birkaç karakterini yazdığında programındaki sınıflardan bir öneri görünür;
**Tab** tuşuyla tamamlayabilirsin. Gün ve saat menülerinde o sınıftaki derslerin
listelenir. İlgili dersi seçip **Ekle** düğmesine tıkla.
Gün seçmeden eklersen o sınıftaki tüm dersler işaretlenir.

**Tutorial ekleme.** Formdaki **Tür** alanından **Tutorial** seçeneğini seç.
Bu kayıtlar mor renkte ve `TUTORIAL` etiketiyle gösterilir.

<br clear="all">

## Kayıtlı lab sınıfları

Listede, lab olarak kullanılan şu Bilgisayar Mühendisliği (CMPE) sınıfları bulunuyor:
CMPE134, 135, 136, 137, 227, 228, 230, 231, 235, 236, 238 ve 239.

Diğer bölümlerin lab sınıfları henüz listede yok. Bu sınıfları kendin ekleyebilir
veya [GitHub'da bir issue açarak](https://github.com/Asilturkmen/Emu-Labmarker/issues/new)
listeye eklenmesini istediğin oda kodunu bildirebilirsin.

## Gizlilik

Eklenti, `student.emu.edu.tr` ve `students.emu.edu.tr` üzerindeki ders programını
tarayıcı içinde okur ve işaretler. Ders programı ve ayarların bir sunucuya gönderilmez.
`storage` izni, aç/kapa tercihini ve eklediğin lab veya tutorial kayıtlarını
tarayıcında saklamak için kullanılır. Ayrıntılar [gizlilik politikasında](PRIVACY.md).

## Geliştirici

Ben Asil Türkmen. EMU LabMarker, kendi kullanımım için geliştirdiğim bağımsız bir
öğrenci projesi; Doğu Akdeniz Üniversitesinin resmî ürünü değil.
Diğer projelerimi ve iletişim bilgilerimi
**[asilturkmen.com](https://asilturkmen.com)** adresinde bulabilirsin.

İşine yaradıysa bir kahve ısmarlayabilirsin:

<a href="https://buymeacoffee.com/turkmenasil"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-turkmenasil-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black" alt="Buy Me a Coffee"></a>

## Lisans

MIT. Ayrıntı [LICENSE](LICENSE) dosyasında.

<br>

<p align="center">
  <sub>© 2026 <a href="https://asilturkmen.com">Asil Türkmen</a></sub>
</p>
