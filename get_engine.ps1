$url = "https://github.com/ggerganov/llama.cpp/releases/download/b3138/llama-b3138-bin-win-vulkan-x64.zip"
$url = (Invoke-RestMethod https://api.github.com/repos/ggerganov/llama.cpp/releases/latest).assets | Where-Object { $_.name -match 'win-vulkan-x64\.zip$' } | Select-Object -ExpandProperty browser_download_url
$zipFile = "llama.zip"
$extractPath = "llama_extract"

Write-Host "Downloading llama-server from $url..."
Invoke-WebRequest -Uri $url -OutFile $zipFile

Write-Host "Extracting..."
Expand-Archive -Path $zipFile -DestinationPath $extractPath -Force

Write-Host "Moving binary..."
New-Item -ItemType Directory -Force -Path "src-tauri/bin"
Move-Item -Path "$extractPath/llama-server.exe" -Destination "src-tauri/bin/llama-server-x86_64-pc-windows-msvc.exe" -Force

Write-Host "Cleaning up..."
Remove-Item $zipFile
Remove-Item $extractPath -Recurse -Force

Write-Host "Done!"
