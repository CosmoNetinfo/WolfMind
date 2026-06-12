$engineDir = "engine\piper"
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

Invoke-WebRequest -Uri $modelUrl -OutFile "$engineDir\it_IT-paola-medium.onnx"
Invoke-WebRequest -Uri $jsonUrl -OutFile "$engineDir\it_IT-paola-medium.onnx.json"

Write-Host "Piper TTS setup complete!"
