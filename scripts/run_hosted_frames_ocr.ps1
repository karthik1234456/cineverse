[void][System.Reflection.Assembly]::LoadWithPartialName('System.Runtime.WindowsRuntime')
[void][Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
[void][Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
[void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.ContainsGenericParameters 
})[0]

function Await-WinRt($asyncOp, $type) {
    $m = $asTaskGeneric.MakeGenericMethod($type)
    $task = $m.Invoke($null, @($asyncOp))
    $task.Wait()
    return $task.Result
}

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
Write-Host "Initialized Windows OCR Engine: $($engine.RecognizerLanguage.DisplayName)"

$jsonInput = & backend\.venv\Scripts\python.exe -c "import sqlite3, json; conn = sqlite3.connect('cineverse.db'); cur = conn.cursor(); cur.execute('SELECT id, title, slug FROM movies WHERE trailer_source_type = \'hosted\' ORDER BY id ASC'); print(json.dumps([{'id': r[0], 'title': r[1], 'slug': r[2]} for r in cur.fetchall()]))"
$movies = $jsonInput | ConvertFrom-Json

$results = @()
$matchedCount = 0
$mismatches = @()

foreach ($m in $movies) {
    $slug = $m.slug
    $title = $m.title
    $frames = @("evidence/ocr_frames/${slug}_f1.png", "evidence/ocr_frames/${slug}_f2.png", "evidence/ocr_frames/${slug}_f3.png")
    
    $combinedOcr = ""
    $frameTexts = @()

    foreach ($fpath in $frames) {
        $full = [System.IO.Path]::GetFullPath($fpath)
        if (Test-Path $full) {
            try {
                $file = Await-WinRt ([Windows.Storage.StorageFile]::GetFileFromPathAsync($full)) ([Windows.Storage.StorageFile])
                $stream = Await-WinRt ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
                $decoder = Await-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
                $bitmap = Await-WinRt ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
                $ocrRes = Await-WinRt ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
                $stream.Dispose()
                $txt = $ocrRes.Text
                $frameTexts += $txt
                $combinedOcr += " " + $txt
            } catch {
                $frameTexts += "ERROR: " + $_.Exception.Message
            }
        }
    }

    # Normalize title and check matching
    # Extract significant title tokens (>= 3 chars, not common stop words)
    $tokens = ($title -replace '[^\w\s]', '' -split '\s+') | Where-Object { 
        $_.Length -ge 3 -and $_ -notin @('The', 'and', 'from', 'with', 'for') 
    }
    
    $matchedTokens = @()
    foreach ($tok in $tokens) {
        if ($combinedOcr -match [regex]::Escape($tok)) {
            $matchedTokens += $tok
        }
    }

    $isMatch = ($matchedTokens.Count -ge [Math]::Ceiling($tokens.Count * 0.5))

    $rec = [PSCustomObject]@{
        id = $m.id
        title = $title
        slug = $slug
        tokens = $tokens
        matched_tokens = $matchedTokens
        is_match = $isMatch
        combined_ocr = $combinedOcr.Trim()
        frames = $frameTexts
    }
    $results += $rec

    if ($isMatch) {
        $matchedCount++
        Write-Host "  [MATCH] $($m.title) (Matched: $($matchedTokens -join ', '))" -ForegroundColor Green
    } else {
        $mismatches += $m
        Write-Host "  [MISMATCH / NO TITLE IN FRAMES] $($m.title) | OCR: '$($combinedOcr.Trim())'" -ForegroundColor Yellow
    }
}

Write-Host "=========================================="
Write-Host "OCR Summary: $matchedCount / $($movies.Count) hosted titles matched in video frames."

$outJson = $results | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText("evidence/ocr_results.json", $outJson)
