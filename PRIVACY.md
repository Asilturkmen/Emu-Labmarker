# Gizlilik Politikası

**EMU LabMarker** — son güncelleme: 21 Ekim 2026

## Kısaca

EMU LabMarker ders programını tarayıcı içinde okur ve işaretler.
Ayarlar ve kullanıcının eklediği kayıtlar yerel olarak saklanır; geliştiriciye
veya üçüncü taraflara gönderilmez. Eklentinin sunucusu yoktur.

## Eklenti ne yapıyor

Eklenti, `https://student.emu.edu.tr` ve `https://students.emu.edu.tr`
üzerindeki ders programı sayfasını (`/Academic/Timetable`) okur.
Ders kodlarını ve oda bilgilerini kullanarak lab ve tutorial işaretlerini ekler.
Eklenti penceresindeki gün ve saat seçenekleri de bu programdan alınır.

Ders programının bir kopyası kalıcı olarak saklanmaz. Kullanıcının eklediği
lab ve tutorial kayıtları ise aşağıda açıklandığı şekilde tarayıcıda tutulur.
Ders programı dışındaki portal sayfalarında içerik okunmaz veya işaretlenmez.

## Tarayıcıda saklananlar

Eklenti, Chrome'un `storage.local` alanında şu ayarları saklar:

- Eklentinin açık mı kapalı mı olduğu bilgisi
- Kullanıcının kendi eklediği lab sınıfı kodları (örneğin `CMPE025`); yalnızca tek
  bir ders için eklendiyse o dersin günü, başlangıç saati ve ders kodu; ayrıca
  sınıfın lab mı tutorial mı olarak eklendiği

Bu ayarlar tarayıcıda saklanır ve bir sunucuya gönderilmez.
Kullanıcı, eklediği kayıtları eklenti penceresinden kaldırabilir.
Eklenti kaldırıldığında tarayıcıdaki kayıtları da silinir.

## Toplanmayan veriler

Eklenti; ad, e-posta adresi, öğrenci numarası, kimlik ve giriş bilgileri,
sağlık veya finansal bilgiler, kişisel mesajlar, konum ya da tarama geçmişi
toplamaz. Kullanıcı etkinliğini izlemez. Sayfa içeriğini yalnızca yukarıda
açıklanan ders programı işlevleri için tarayıcı içinde işler.

Eklenti çerez kullanmaz, analitik veya izleme aracı içermez, reklam göstermez.

## Uzak kod

Eklentinin tüm kodu paketin içinde gelir. Çalışma sırasında dışarıdan hiçbir
betik, stil veya kod parçası indirilmez ya da çalıştırılmaz.

## Bağımsızlık

Bu eklenti bağımsız bir öğrenci projesidir ve Doğu Akdeniz Üniversitesi ile
resmî bir bağlantısı yoktur.

## Değişiklikler

Bu politika değişirse bu dosya güncellenir ve üstteki tarih değiştirilir.

## İletişim

Asil Türkmen — [asilturkmen.com](https://asilturkmen.com)
Sorular ve bildirimler için:
[GitHub issues](https://github.com/Asilturkmen/Emu-Labmarker/issues)
