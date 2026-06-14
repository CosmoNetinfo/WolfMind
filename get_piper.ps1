$engineDir = "engine\piper"
if (Test-Path "$engineDir\piper.exe") {
    Write-Host "Piper is already installed in $engineDir. Skipping download."
    exit
}
New-Item -ItemType Directory -Force -Path $engineDir

$piperUrl = "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip"
$piperZip = "piper.zip"

Write-Host "Downloading Piper..."
Invoke-WebRequest -Uri $piperUrl -OutFile $piperZip
Expand-Archive -Path $piperZip -DestinationPath $engineDir -Force
Remove-Item $piperZip

# The zip extracts a folder named 'piper', so let's move contents up and delete the folder
Move-Item -Path "$engineDir\piper\*" -Destination $engineDir -Force
Remove-Item "$engineDir\piper" -Recurse -Force

Write-Host "Downloading Paola Medium Model..."
$modelUrl = "https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/paola/medium/it_IT-paola-medium.onnx"
$jsonUrl = "https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/paola/medium/it_IT-paola-medium.onnx.json"
$modelUrlMirror = "https://hf-mirror.com/rhasspy/piper-voices/resolve/main/it/it_IT/paola/medium/it_IT-paola-medium.onnx"
$jsonUrlMirror = "https://hf-mirror.com/rhasspy/piper-voices/resolve/main/it/it_IT/paola/medium/it_IT-paola-medium.onnx.json"

function Download-WithRetry {
    param([string]$url, [string]$urlMirror, [string]$outFile)
    $maxRetries = 3
    for ($i = 1; $i -le $maxRetries; $i++) {
        try {
            Invoke-WebRequest -Uri $url -OutFile $outFile -UserAgent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" -ErrorAction Stop
            return
        } catch {
            Write-Host "Attempt $i failed for $url. Error: $($_.Exception.Message)"
            if ($i -eq $maxRetries) {
                Write-Host "Trying mirror..."
                Invoke-WebRequest -Uri $urlMirror -OutFile $outFile -UserAgent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                return
            }
            Start-Sleep -Seconds 10
        }
    }
}

Download-WithRetry -url $modelUrl -urlMirror $modelUrlMirror -outFile "$engineDir\it_IT-paola-medium.onnx"
Download-WithRetry -url $jsonUrl -urlMirror $jsonUrlMirror -outFile "$engineDir\it_IT-paola-medium.onnx.json"

Write-Host "Piper TTS setup complete!"
