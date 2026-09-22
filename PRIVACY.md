# Gizlilik Politikası

**EMU LabMarker** — son güncelleme: 18 Eylül 2026

## Kısaca

EMU LabMarker hiçbir veri toplamaz, saklamaz veya üçüncü taraflarla paylaşmaz.
Eklentinin geliştiricisi dahil hiç kimseye hiçbir bilgi gönderilmez. Eklentinin
sunucusu yoktur ve hiçbir ağ isteği yapmaz.

## Eklenti ne yapıyor

EMU LabMarker yalnızca `https://student.emu.edu.tr` ve `https://students.emu.edu.tr`
alan adlarında, yalnızca ders programı sayfasında (`/Academic/Timetable`) çalışır.
Bu sayfada zaten ekranda görünen ders programı tablosunu okur ve laboratuvar
derslerini renkli olarak işaretler. Okunan bilgi tarayıcının dışına çıkmaz; sayfa
kapandığında geriye hiçbir kayıt kalmaz.

Adres ders programı sayfası değilse eklenti hiçbir şey yapmadan sonlanır.

## Tarayıcıda saklananlar

Eklenti, Chrome'un `storage` iznini yalnızca iki şey için kullanır:

- Eklentinin açık mı kapalı mı olduğu bilgisi
- Kullanıcının kendi eklediği lab sınıfı kodları (örneğin `CMPE025`)

Bu iki bilgi yalnızca kullanıcının kendi tarayıcısında durur. Hiçbir yere
gönderilmez. Eklenti kaldırıldığında tarayıcı bu verileri de siler; kullanıcı
dilediği zaman eklediği sınıfları eklenti penceresinden tek tek kaldırabilir.

## Toplanmayan veriler

Aşağıdakilerin hiçbiri toplanmaz, işlenmez veya aktarılmaz: kimlik bilgileri,
ad, e-posta adresi, öğrenci numarası, sağlık bilgisi, finansal bilgi, kimlik
doğrulama bilgisi, kişisel iletişim içeriği, konum, web geçmişi, kullanıcı
etkinliği ve web sitesi içeriği.

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
