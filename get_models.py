import urllib.request, json
url = "https://openrouter.ai/api/v1/models"
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    qwen = [m['id'] for m in data['data'] if 'qwen' in m['id'].lower() and '72b' in m['id'].lower()]
    print("Qwen 72b models:", qwen)
