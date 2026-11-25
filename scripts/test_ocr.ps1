param([string]$ImagePath)

[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null

$fullPath = [System.IO.Path]::GetFullPath($ImagePath)
$fileTask = [Windows.Storage.StorageFile]::GetFileFromPathAsync($fullPath).AsTask()
$fileTask.Wait()
$storageFile = $fileTask.Result

$streamTask = $storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read).AsTask()
$streamTask.Wait()
$stream = $streamTask.Result

$decoderTask = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream).AsTask()
$decoderTask.Wait()
$decoder = $decoderTask.Result

$bitmapTask = $decoder.GetSoftwareBitmapAsync().AsTask()
$bitmapTask.Wait()
$bitmap = $bitmapTask.Result

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$ocrTask = $engine.RecognizeAsync($bitmap).AsTask()
$ocrTask.Wait()
$ocrResult = $ocrTask.Result

$stream.Dispose()
Write-Output "OCR Text found: '$($ocrResult.Text)'"
